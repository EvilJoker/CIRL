import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import https from 'https'
import http from 'http'
import { URL } from 'url'
import {
  readApps,
  saveApps,
  readQueryRecords,
  saveQueryRecords,
  readFeedbacks,
  saveFeedbacks,
  readDatasets,
  saveDatasets,
  readHitAnalyses,
  saveHitAnalyses,
  readEvaluations,
  saveEvaluations,
  readOptimizationSuggestions,
  saveOptimizationSuggestions,
  readModels,
  saveModels,
  getRequestStats
} from './dataManager.js'
import { calculateSimilarity, getMatchType } from './similarityService.js'
import { calculateEvaluationMetrics } from './evaluationService.js'
import { swaggerSpec } from './swagger.js'
import { logger, closeLogger } from './logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const HIT_ANALYSIS_WINDOWS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
}

const app = express()
const PORT = process.env.PORT || 10001

app.use(cors())
app.use(express.json())

// HTTP 请求日志中间件
app.use((req, res, next) => {
  const startTime = Date.now()
  const originalEnd = res.end

  res.end = function (...args) {
    const duration = Date.now() - startTime
    // 只记录 API 请求，跳过静态资源
    if (req.path.startsWith('/api')) {
      logger.request(req.method, req.path, res.statusCode, duration)
    }
    originalEnd.apply(this, args)
  }

  next()
})

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CIRL API 文档'
}))

// 静态文件服务（前端构建产物）
app.use(express.static(join(__dirname, '..', 'dist')))

function updateRecordAnalysisMetadata(record, matchType, similarity, analyzedAt, extra = {}) {
  record.metadata = {
    ...(record.metadata || {}),
    lastAnalyzedAt: analyzedAt,
    lastMatchType: matchType,
    lastSimilarity: similarity,
    lastAnalysisRange: extra.range || record.metadata?.lastAnalysisRange,
    lastAnalysisModelId: extra.modelId || record.metadata?.lastAnalysisModelId,
    lastMatchedRecordId: extra.matchedQueryRecordId || record.metadata?.lastMatchedRecordId
  }
}

function parseAnalysisResultMetadata(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

async function performHitAnalysisTask({ appId, range, modelId }) {
  if (!HIT_ANALYSIS_WINDOWS[range]) {
    throw new Error('Invalid time range')
  }

  const windowMs = HIT_ANALYSIS_WINDOWS[range]
  const now = new Date()
  const startDate = new Date(now.getTime() - windowMs)

  const allRecords = await readQueryRecords()
  const sourceRecords = allRecords.filter(r => {
    if (r.appId !== appId) return false
    if (r.curated) return false
    if (r.ignored) return false
    const createdAt = new Date(r.createdAt)
    return createdAt >= startDate
  })
  const curatedRecords = allRecords.filter(r => r.appId === appId && r.curated)

  if (sourceRecords.length === 0 || curatedRecords.length === 0) {
    return {
      count: 0,
      analyses: [],
      summary: { exact: 0, high: 0, medium: 0, none: sourceRecords.length },
      range,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    }
  }

  const hitAnalyses = await readHitAnalyses()
  const newAnalyses = []
  const curatedMap = new Map(curatedRecords.map(record => [record.id, record]))
  const curatedSnapshots = new Map()
  const sourceIdSet = new Set(sourceRecords.map(r => r.id))

  // 移除同一时间范围内的旧分析结果，避免重复统计
  const retainedAnalyses = hitAnalyses.filter(analysis => {
    if (!sourceIdSet.has(analysis.queryRecordId)) {
      return true
    }
    const meta = parseAnalysisResultMetadata(analysis.analysisResult)
    return meta.range !== range || meta.appId !== appId
  })

  const summary = { exact: 0, high: 0, medium: 0, none: 0, total: 0 }

  for (const record of sourceRecords) {
    let maxSimilarity = 0
    let matchedRecordId = null
    for (const curated of curatedRecords) {
      const similarity = calculateSimilarity(record.input, curated.input)
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity
        matchedRecordId = curated.id
      }
    }

    const matchType = getMatchType(maxSimilarity)
    summary[matchType] += 1
    summary.total += 1

    const analyzedAt = new Date().toISOString()
    const analysis = {
      id: `ha_${Date.now()}_${newAnalyses.length}`,
      queryRecordId: record.id,
      datasetId: `qa_library:${appId}`,
      matchType,
      similarity: maxSimilarity,
      matchedQueryRecordId: matchedRecordId || undefined,
      analysisResult: {
        range,
        modelId: modelId || null,
        appId
      },
      createdAt: analyzedAt
    }
    newAnalyses.push(analysis)
    updateRecordAnalysisMetadata(record, matchType, maxSimilarity, analyzedAt, {
      range,
      modelId: modelId || null,
      matchedQueryRecordId: matchedRecordId || null
    })

    if (matchedRecordId) {
      if (!curatedSnapshots.has(matchedRecordId)) {
        curatedSnapshots.set(matchedRecordId, {
          exact: 0,
          high: 0,
          medium: 0,
          none: 0,
          total: 0
        })
      }
      const stats = curatedSnapshots.get(matchedRecordId)
      stats[matchType] += 1
      stats.total += 1
      stats.lastMatchedAt = analyzedAt
    }
  }

  for (const [targetId, stats] of curatedSnapshots.entries()) {
    const targetRecord = curatedMap.get(targetId)
    if (!targetRecord) continue
    const metadata = targetRecord.metadata || {}
    const hitSnapshots = metadata.hitSnapshots || {}
    hitSnapshots[range] = {
      ...stats,
      updatedAt: new Date().toISOString()
    }
    targetRecord.metadata = {
      ...metadata,
      hitSnapshots
    }
  }

  const finalAnalyses = [...retainedAnalyses, ...newAnalyses]
  await saveHitAnalyses(finalAnalyses)
  await saveQueryRecords(allRecords)

  return {
    count: newAnalyses.length,
    analyses: newAnalyses,
    summary,
    range,
    startDate: startDate.toISOString(),
    endDate: now.toISOString()
  }
}

// ========== 应用（App）管理 API ==========

/**
 * @swagger
 * /api/apps:
 *   get:
 *     summary: 获取所有应用
 *     tags: [Apps]
 *     responses:
 *       200:
 *         description: 应用列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/App'
 */
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await readApps()
    res.json({ data: apps })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/apps/{id}:
 *   get:
 *     summary: 获取单个应用
 *     tags: [Apps]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 应用ID
 *     responses:
 *       200:
 *         description: 应用详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/App'
 *       404:
 *         description: 应用不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/apps/:id', async (req, res) => {
  try {
    const apps = await readApps()
    const appItem = apps.find(a => a.id === req.params.id)
    if (!appItem) {
      return res.status(404).json({ error: 'App not found' })
    }
    res.json(appItem)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/apps:
 *   post:
 *     summary: 创建应用
 *     tags: [Apps]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Support Copilot
 *               description:
 *                 type: string
 *                 example: 客服 FAQ 问答助手
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/App'
 *       400:
 *         description: 请求参数错误
 */
app.post('/api/apps', async (req, res) => {
  try {
    const apps = await readApps()
    const newApp = {
      id: `app_${Date.now()}`,
      name: req.body.name || '新应用',
      description: req.body.description || '',
      metadata: req.body.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    apps.push(newApp)
    await saveApps(apps)
    res.json(newApp)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/apps/{id}:
 *   put:
 *     summary: 更新应用
 *     tags: [Apps]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/App'
 *       404:
 *         description: 应用不存在
 */
app.put('/api/apps/:id', async (req, res) => {
  try {
    const apps = await readApps()
    const index = apps.findIndex(a => a.id === req.params.id)
    if (index === -1) {
      return res.status(404).json({ error: 'App not found' })
    }
    apps[index] = {
      ...apps[index],
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    }
    await saveApps(apps)
    res.json(apps[index])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/apps/{id}:
 *   delete:
 *     summary: 删除应用
 *     tags: [Apps]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: 应用不存在
 */
app.delete('/api/apps/:id', async (req, res) => {
  try {
    const apps = await readApps()
    const filtered = apps.filter(a => a.id !== req.params.id)
    await saveApps(filtered)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/stats/requests:
 *   get:
 *     summary: 获取请求统计信息
 *     tags: [Stats]
 *     parameters:
 *       - in: query
 *         name: appIds
 *         schema:
 *           type: string
 *         description: 应用ID列表，多个用逗号分隔，为空则统计所有应用
 *     responses:
 *       200:
 *         description: 统计信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       appId:
 *                         type: string
 *                       count24h:
 *                         type: number
 *                         description: 24小时内的请求次数
 *                       count7d:
 *                         type: number
 *                         description: 7天内的请求次数
 *                       count30d:
 *                         type: number
 *                         description: 30天内的请求次数
 *                       timeline24h:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *                             value:
 *                               type: number
 *                       timeline7d:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *                             value:
 *                               type: number
 *                       timeline30d:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *                             value:
 *                               type: number
 */
app.get('/api/stats/requests', async (req, res) => {
  try {
    const appIds = req.query.appIds ? req.query.appIds.split(',').filter(id => id.trim()) : []
    const stats = await getRequestStats(appIds)
    res.json({ data: stats })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ========== 问答记录（QueryRecord）API ==========

/**
 * @swagger
 * /api/query-records:
 *   get:
 *     summary: 获取问答记录列表
 *     tags: [QueryRecords]
 *     parameters:
 *       - in: query
 *         name: appId
 *         schema:
 *           type: string
 *         description: 应用ID筛选
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期（ISO 格式）
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期（ISO 格式）
 *       - in: query
 *         name: curated
 *         schema:
 *           type: boolean
 *         description: 是否已精选
 *       - in: query
 *         name: ignored
 *         schema:
 *           type: boolean
 *         description: 是否已忽略
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 关键字（匹配输入/输出）
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页大小
 *     responses:
 *       200:
 *         description: 问答记录列表（分页）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
app.get('/api/query-records', async (req, res) => {
  try {
    const { appId, startDate, endDate, curated, ignored, keyword, page = 1, pageSize = 20 } = req.query
    let records = await readQueryRecords()

    // 筛选
    if (appId) {
      records = records.filter(r => r.appId === appId)
    }
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase()
      records = records.filter(r =>
        (r.input || '').toLowerCase().includes(lowerKeyword) ||
        (r.output || '').toLowerCase().includes(lowerKeyword)
      )
    }
    if (startDate) {
      records = records.filter(r => new Date(r.createdAt) >= new Date(startDate))
    }
    if (endDate) {
      records = records.filter(r => new Date(r.createdAt) <= new Date(endDate))
    }
    if (curated !== undefined) {
      const curatedFlag = curated === 'true'
      records = records.filter(r => Boolean(r.curated) === curatedFlag)
    }
    if (ignored !== undefined) {
      const ignoredFlag = ignored === 'true'
      records = records.filter(r => Boolean(r.ignored) === ignoredFlag)
    }

    // 排序（最新的在前）
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    // 分页
    const start = (parseInt(page) - 1) * parseInt(pageSize)
    const end = start + parseInt(pageSize)
    const paginatedRecords = records.slice(start, end)

    res.json({
      data: paginatedRecords,
      total: records.length,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/query-records/{id}:
 *   get:
 *     summary: 获取单个问答记录
 *     tags: [QueryRecords]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 问答记录详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueryRecord'
 *       404:
 *         description: 记录不存在
 */
app.get('/api/query-records/:id', async (req, res) => {
  try {
    const records = await readQueryRecords()
    const record = records.find(r => r.id === req.params.id)
    if (!record) {
      return res.status(404).json({ error: 'Query record not found' })
    }
    res.json(record)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/query-records:
 *   post:
 *     summary: 创建问答记录
 *     description: 外部系统调用此接口记录问答日志
 *     tags: [QueryRecords]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appId
 *               - input
 *               - output
 *             properties:
 *               appId:
 *                 type: string
 *                 example: app_1234567890
 *               input:
 *                 type: string
 *                 example: 如何重置密码？
 *               output:
 *                 type: string
 *                 example: 请打开设置 > 安全 > 密码，按照向导完成重置。
 *               modelId:
 *                 type: string
 *                 example: gpt-4o-mini
 *               context:
 *                 type: object
 *                 additionalProperties: true
 *               metadata:
 *                 type: object
 *                 properties:
 *                   responseTime:
 *                     type: number
 *                     description: 响应时间（毫秒）
 *                 additionalProperties: true
 *               curated:
 *                 type: boolean
 *                 default: false
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueryRecord'
 *       400:
 *         description: 请求参数错误
 */
app.post('/api/query-records', async (req, res) => {
  try {
    const { appId, input, output, modelId, context, metadata } = req.body
    if (!appId || !input || !output) {
      return res.status(400).json({ error: 'appId, input, and output are required' })
    }

    const records = await readQueryRecords()
    const newRecord = {
      id: `qr_${Date.now()}`,
      appId,
      input,
      output,
      modelId,
      context,
      curated: req.body.curated ?? false,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    records.push(newRecord)
    await saveQueryRecords(records)
    logger.debug(`创建问答记录: ${newRecord.id} (appId: ${appId})`)
    res.json(newRecord)
  } catch (error) {
    logger.error('创建问答记录失败:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/query-records/{id}:
 *   put:
 *     summary: 更新问答记录
 *     tags: [QueryRecords]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: string
 *               output:
 *                 type: string
 *               curated:
 *                 type: boolean
 *               ignored:
 *                 type: boolean
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueryRecord'
 *       404:
 *         description: 记录不存在
 */
app.put('/api/query-records/:id', async (req, res) => {
  try {
    const records = await readQueryRecords()
    const index = records.findIndex(r => r.id === req.params.id)
    if (index === -1) {
      return res.status(404).json({ error: 'Query record not found' })
    }
    records[index] = {
      ...records[index],
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    }
    await saveQueryRecords(records)
    res.json(records[index])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ========== 反馈（Feedback）API ==========

/**
 * @swagger
 * /api/feedbacks:
 *   get:
 *     summary: 获取反馈列表
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processed, resolved]
 *         description: 反馈状态筛选
 *       - in: query
 *         name: appId
 *         schema:
 *           type: string
 *         description: 应用ID筛选
 *       - in: query
 *         name: queryRecordId
 *         schema:
 *           type: string
 *         description: 问答记录ID筛选
 *     responses:
 *       200:
 *         description: 反馈列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Feedback'
 */
app.get('/api/feedbacks', async (req, res) => {
  try {
    const { status, appId, queryRecordId } = req.query
    let feedbacks = await readFeedbacks()

    if (status) {
      feedbacks = feedbacks.filter(f => f.status === status)
    }
    if (queryRecordId) {
      feedbacks = feedbacks.filter(f => f.queryRecordId === queryRecordId)
    }
    if (appId) {
      const records = await readQueryRecords()
      const recordIds = records.filter(r => r.appId === appId).map(r => r.id)
      feedbacks = feedbacks.filter(f => recordIds.includes(f.queryRecordId))
    }

    res.json({ data: feedbacks })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/feedbacks:
 *   post:
 *     summary: 创建反馈
 *     tags: [Feedbacks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - queryRecordId
 *               - type
 *             properties:
 *               queryRecordId:
 *                 type: string
 *                 example: qr_1234567890
 *               type:
 *                 type: string
 *                 enum: [positive, negative, neutral, correction]
 *                 example: negative
 *               content:
 *                 type: string
 *                 example: 答案不够具体
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 2
 *               correction:
 *                 type: string
 *                 description: 纠正后的答案（当 type 为 correction 时）
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       400:
 *         description: 请求参数错误
 */
app.post('/api/feedbacks', async (req, res) => {
  try {
    const { queryRecordId, type, content, rating, correction } = req.body
    if (!queryRecordId || !type) {
      return res.status(400).json({ error: 'queryRecordId and type are required' })
    }

    const feedbacks = await readFeedbacks()
    const newFeedback = {
      id: `fb_${Date.now()}`,
      queryRecordId,
      type,
      content,
      rating,
      correction,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    feedbacks.push(newFeedback)
    await saveFeedbacks(feedbacks)
    res.json(newFeedback)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/feedbacks/{id}:
 *   put:
 *     summary: 更新反馈
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, processed, resolved]
 *               resolution:
 *                 type: string
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Feedback'
 *       404:
 *         description: 反馈不存在
 */
app.put('/api/feedbacks/:id', async (req, res) => {
  try {
    const feedbacks = await readFeedbacks()
    const index = feedbacks.findIndex(f => f.id === req.params.id)
    if (index === -1) {
      return res.status(404).json({ error: 'Feedback not found' })
    }

    const updateData = { ...req.body }
    if (updateData.status === 'processed' && !feedbacks[index].processedAt) {
      updateData.processedAt = new Date().toISOString()
    }

    feedbacks[index] = {
      ...feedbacks[index],
      ...updateData,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    }
    await saveFeedbacks(feedbacks)
    res.json(feedbacks[index])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/feedbacks/{id}/analyze:
 *   post:
 *     summary: AI 分析反馈并生成优化建议
 *     description: 分析反馈内容，自动生成优化建议
 *     tags: [Feedbacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 分析成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 feedback:
 *                   $ref: '#/components/schemas/Feedback'
 *                 suggestion:
 *                   $ref: '#/components/schemas/OptimizationSuggestion'
 *       404:
 *         description: 反馈不存在
 */
app.post('/api/feedbacks/:id/analyze', async (req, res) => {
  try {
    const feedbacks = await readFeedbacks()
    const feedback = feedbacks.find(f => f.id === req.params.id)
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' })
    }

    // TODO: 接入 AI 服务进行实际分析
    // 目前返回简单的分析结果
    const suggestion = `基于反馈类型 ${feedback.type}，建议优化相关问答记录的处理逻辑。`

    feedback.optimizationSuggestion = suggestion
    feedback.status = 'processed'
    feedback.processedAt = new Date().toISOString()
    feedback.updatedAt = new Date().toISOString()

    await saveFeedbacks(feedbacks)

    // 创建优化建议
    const suggestions = await readOptimizationSuggestions()
    const newSuggestion = {
      id: `opt_${Date.now()}`,
      appId: (await readQueryRecords()).find(r => r.id === feedback.queryRecordId)?.appId || '',
      source: 'feedback',
      sourceId: feedback.id,
      priority: feedback.type === 'negative' ? 'high' : 'medium',
      content: suggestion,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    suggestions.push(newSuggestion)
    await saveOptimizationSuggestions(suggestions)

    res.json({ feedback, suggestion: newSuggestion })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ========== 数据集（Dataset）API ==========

/**
 * @swagger
 * /api/datasets:
 *   get:
 *     summary: 获取数据集列表
 *     tags: [Datasets]
 *     parameters:
 *       - in: query
 *         name: appId
 *         schema:
 *           type: string
 *         description: 应用ID筛选
 *     responses:
 *       200:
 *         description: 数据集列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Dataset'
 */
app.get('/api/datasets', async (req, res) => {
  try {
    const { appId } = req.query
    let datasets = await readDatasets()

    if (appId) {
      datasets = datasets.filter(d => d.appId === appId)
    }

    res.json({ data: datasets })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/datasets/{id}:
 *   get:
 *     summary: 获取数据集详情
 *     tags: [Datasets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 数据集详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dataset'
 *       404:
 *         description: 数据集不存在
 */
app.get('/api/datasets/:id', async (req, res) => {
  try {
    const datasets = await readDatasets()
    const dataset = datasets.find(d => d.id === req.params.id)
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' })
    }
    res.json(dataset)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/datasets:
 *   post:
 *     summary: 创建数据集
 *     tags: [Datasets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appId
 *               - name
 *             properties:
 *               appId:
 *                 type: string
 *                 example: app_1234567890
 *               name:
 *                 type: string
 *                 example: 常见问题-2025Q1
 *               description:
 *                 type: string
 *                 example: 一季度常见问题
 *               queryRecordIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["qr_1", "qr_2"]
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dataset'
 *       400:
 *         description: 请求参数错误
 */
app.post('/api/datasets', async (req, res) => {
  try {
    const { appId, name, description, queryRecordIds } = req.body
    if (!appId || !name) {
      return res.status(400).json({ error: 'appId and name are required' })
    }

    const datasets = await readDatasets()
    const newDataset = {
      id: `ds_${Date.now()}`,
      appId,
      name,
      description: description || '',
      queryRecordIds: queryRecordIds || [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    datasets.push(newDataset)
    await saveDatasets(datasets)
    res.json(newDataset)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/datasets/{id}:
 *   put:
 *     summary: 更新数据集
 *     tags: [Datasets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               queryRecordIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Dataset'
 *       404:
 *         description: 数据集不存在
 */
app.put('/api/datasets/:id', async (req, res) => {
  try {
    const datasets = await readDatasets()
    const index = datasets.findIndex(d => d.id === req.params.id)
    if (index === -1) {
      return res.status(404).json({ error: 'Dataset not found' })
    }
    datasets[index] = {
      ...datasets[index],
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    }
    await saveDatasets(datasets)
    res.json(datasets[index])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/datasets/{id}:
 *   delete:
 *     summary: 删除数据集
 *     tags: [Datasets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: 数据集不存在
 */
app.delete('/api/datasets/:id', async (req, res) => {
  try {
    const datasets = await readDatasets()
    const filtered = datasets.filter(d => d.id !== req.params.id)
    await saveDatasets(filtered)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 添加问答记录到数据集
app.post('/api/datasets/:id/records', async (req, res) => {
  try {
    const { recordId } = req.body
    if (!recordId) {
      return res.status(400).json({ error: 'recordId is required' })
    }
    const datasets = await readDatasets()
    const dataset = datasets.find(d => d.id === req.params.id)
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' })
    }
    if (!dataset.queryRecordIds.includes(recordId)) {
      dataset.queryRecordIds.push(recordId)
      dataset.updatedAt = new Date().toISOString()
      await saveDatasets(datasets)
    }
    res.json(dataset)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 从数据集中移除问答记录
app.delete('/api/datasets/:id/records/:recordId', async (req, res) => {
  try {
    const datasets = await readDatasets()
    const dataset = datasets.find(d => d.id === req.params.id)
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' })
    }
    dataset.queryRecordIds = dataset.queryRecordIds.filter(id => id !== req.params.recordId)
    dataset.updatedAt = new Date().toISOString()
    await saveDatasets(datasets)
    res.json(dataset)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ========== 命中分析（HitAnalysis）API ==========

/**
 * @swagger
 * /api/hit-analyses:
 *   post:
 *     summary: 运行命中分析
 *     description: 按时间范围分析 QA 跟踪与 QA 管理之间的命中情况
 *     tags: [HitAnalyses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appId
 *               - range
 *               - modelId
 *             properties:
 *               appId:
 *                 type: string
 *               range:
 *                 type: string
 *                 enum: [24h, 7d, 30d]
 *               modelId:
 *                 type: string
 *     responses:
 *       200:
 *         description: 分析完成
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 summary:
 *                   type: object
 *                   properties:
 *                     exact:
 *                       type: integer
 *                     high:
 *                       type: integer
 *                     medium:
 *                       type: integer
 *                     none:
 *                       type: integer
 *       400:
 *         description: 请求参数错误
 */
app.post('/api/hit-analyses', async (req, res) => {
  try {
    const { appId, range, modelId } = req.body
    if (!appId || !range || !modelId) {
      return res.status(400).json({ error: 'appId, range, and modelId are required' })
    }
    const result = await performHitAnalysisTask({ appId, range, modelId })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/hit-analyses:
 *   get:
 *     summary: 获取命中分析结果
 *     tags: [HitAnalyses]
 *     parameters:
 *       - in: query
 *         name: appId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *     responses:
 *       200:
 *         description: 命中分析结果列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HitAnalysis'
 */
app.get('/api/hit-analyses', async (req, res) => {
  try {
    const { appId, startDate, endDate, range } = req.query
    let analyses = await readHitAnalyses()

    if (range) {
      analyses = analyses.filter(analysis => {
        const meta = parseAnalysisResultMetadata(analysis.analysisResult)
        return meta.range === range
      })
    }
    if (appId || startDate || endDate) {
      const records = await readQueryRecords()
      let filteredRecords = records
      if (appId) {
        filteredRecords = filteredRecords.filter(r => r.appId === appId)
      }
      if (startDate) {
        filteredRecords = filteredRecords.filter(r => new Date(r.createdAt) >= new Date(startDate))
      }
      if (endDate) {
        filteredRecords = filteredRecords.filter(r => new Date(r.createdAt) <= new Date(endDate))
      }
      const recordIds = filteredRecords.map(r => r.id)
      analyses = analyses.filter(a => recordIds.includes(a.queryRecordId))
    }

    res.json({ data: analyses })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/hit-analyses/stats:
 *   get:
 *     summary: 获取命中分析统计
 *     description: 统计完全命中、80%相似、60%相似、未命中的数量
 *     tags: [HitAnalyses]
 *     parameters:
 *       - in: query
 *         name: appId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *     responses:
 *       200:
 *         description: 命中统计
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exact:
 *                   type: integer
 *                   description: 完全命中数
 *                 high:
 *                   type: integer
 *                   description: 80%相似命中数
 *                 medium:
 *                   type: integer
 *                   description: 60%相似命中数
 *                 none:
 *                   type: integer
 *                   description: 未命中数
 *                 total:
 *                   type: integer
 *                   description: 总数
 */
app.get('/api/hit-analyses/stats', async (req, res) => {
  try {
    const { appId, startDate, endDate, range } = req.query
    let analyses = await readHitAnalyses()

    if (range) {
      analyses = analyses.filter(analysis => {
        const meta = parseAnalysisResultMetadata(analysis.analysisResult)
        return meta.range === range
      })
    }
    if (appId || startDate || endDate) {
      const records = await readQueryRecords()
      let filteredRecords = records
      if (appId) {
        filteredRecords = filteredRecords.filter(r => r.appId === appId)
      }
      if (startDate) {
        filteredRecords = filteredRecords.filter(r => new Date(r.createdAt) >= new Date(startDate))
      }
      if (endDate) {
        filteredRecords = filteredRecords.filter(r => new Date(r.createdAt) <= new Date(endDate))
      }
      const recordIds = filteredRecords.map(r => r.id)
      analyses = analyses.filter(a => recordIds.includes(a.queryRecordId))
    }

    const stats = {
      exact: analyses.filter(a => a.matchType === 'exact').length,
      high: analyses.filter(a => a.matchType === 'high').length,
      medium: analyses.filter(a => a.matchType === 'medium').length,
      none: analyses.filter(a => a.matchType === 'none').length,
      total: analyses.length
    }

    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ========== 效果评估（Evaluation）API ==========

/**
 * @swagger
 * /api/evaluations:
 *   post:
 *     summary: 创建评估任务
 *     description: 评估应用在数据集上的表现（准确性、速度、命中率等）
 *     tags: [Evaluations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appId
 *               - datasetId
 *               - evaluationType
 *               - startDate
 *               - endDate
 *             properties:
 *               appId:
 *                 type: string
 *                 example: app_1234567890
 *               datasetId:
 *                 type: string
 *                 example: ds_1234567890
 *               evaluationType:
 *                 type: string
 *                 enum: [before, after]
 *                 description: 评估类型：优化前或优化后
 *                 example: before
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: '2025-01-01'
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: '2025-01-31'
 *     responses:
 *       200:
 *         description: 评估完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Evaluation'
 *       400:
 *         description: 请求参数错误
 */
app.post('/api/evaluations', async (req, res) => {
  try {
    const { appId, datasetId, evaluationType, startDate, endDate } = req.body
    if (!appId || !datasetId || !evaluationType || !startDate || !endDate) {
      return res.status(400).json({ error: 'appId, datasetId, evaluationType, startDate, and endDate are required' })
    }

    // 获取时间范围内的问答记录
    let queryRecords = await readQueryRecords()
    queryRecords = queryRecords.filter(r => r.appId === appId)
    queryRecords = queryRecords.filter(r => {
      const date = new Date(r.createdAt)
      return date >= new Date(startDate) && date <= new Date(endDate)
    })

    const recordIds = queryRecords.map(r => r.id)

    // 获取相关的命中分析
    const hitAnalyses = await readHitAnalyses()
    const relevantAnalyses = hitAnalyses.filter(a =>
      a.datasetId === datasetId && recordIds.includes(a.queryRecordId)
    )

    // 获取相关的反馈
    const feedbacks = await readFeedbacks()
    const relevantFeedbacks = feedbacks.filter(f => recordIds.includes(f.queryRecordId))

    // 计算评估指标
    const metrics = calculateEvaluationMetrics(queryRecords, relevantAnalyses, relevantFeedbacks)

    const evaluations = await readEvaluations()
    const newEvaluation = {
      id: `ev_${Date.now()}`,
      appId,
      datasetId,
      evaluationType,
      metrics,
      queryRecordIds: recordIds,
      evaluatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    evaluations.push(newEvaluation)
    await saveEvaluations(evaluations)

    res.json(newEvaluation)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/evaluations:
 *   get:
 *     summary: 获取评估结果
 *     tags: [Evaluations]
 *     parameters:
 *       - in: query
 *         name: appId
 *         schema:
 *           type: string
 *       - in: query
 *         name: datasetId
 *         schema:
 *           type: string
 *       - in: query
 *         name: evaluationType
 *         schema:
 *           type: string
 *           enum: [before, after]
 *     responses:
 *       200:
 *         description: 评估结果列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Evaluation'
 */
app.get('/api/evaluations', async (req, res) => {
  try {
    const { appId, datasetId, evaluationType } = req.query
    let evaluations = await readEvaluations()

    if (appId) {
      evaluations = evaluations.filter(e => e.appId === appId)
    }
    if (datasetId) {
      evaluations = evaluations.filter(e => e.datasetId === datasetId)
    }
    if (evaluationType) {
      evaluations = evaluations.filter(e => e.evaluationType === evaluationType)
    }

    res.json({ data: evaluations })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/evaluations/compare:
 *   get:
 *     summary: 对比优化前后
 *     description: 对比优化前后的评估结果，验证优化成效
 *     tags: [Evaluations]
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 对比结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 before:
 *                   $ref: '#/components/schemas/Evaluation'
 *                 after:
 *                   $ref: '#/components/schemas/Evaluation'
 *       400:
 *         description: 请求参数错误
 */
app.get('/api/evaluations/compare', async (req, res) => {
  try {
    const { appId, datasetId } = req.query
    if (!appId || !datasetId) {
      return res.status(400).json({ error: 'appId and datasetId are required' })
    }

    const evaluations = await readEvaluations()
    const before = evaluations.find(e =>
      e.appId === appId && e.datasetId === datasetId && e.evaluationType === 'before'
    )
    const after = evaluations.find(e =>
      e.appId === appId && e.datasetId === datasetId && e.evaluationType === 'after'
    )

    res.json({ before, after })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ========== 优化建议（OptimizationSuggestion）API ==========

/**
 * @swagger
 * /api/optimization-suggestions:
 *   get:
 *     summary: 获取优化建议列表
 *     tags: [OptimizationSuggestions]
 *     parameters:
 *       - in: query
 *         name: appId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, applied, rejected]
 *     responses:
 *       200:
 *         description: 优化建议列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OptimizationSuggestion'
 */
app.get('/api/optimization-suggestions', async (req, res) => {
  try {
    const { appId, status } = req.query
    let suggestions = await readOptimizationSuggestions()

    if (appId) {
      suggestions = suggestions.filter(s => s.appId === appId)
    }
    if (status) {
      suggestions = suggestions.filter(s => s.status === status)
    }

    res.json({ data: suggestions })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/optimization-suggestions/{id}:
 *   put:
 *     summary: 更新优化建议状态
 *     tags: [OptimizationSuggestions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, applied, rejected]
 *                 example: applied
 *               result:
 *                 type: string
 *                 example: 已更新数据集并重新训练
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OptimizationSuggestion'
 *       404:
 *         description: 建议不存在
 */
app.put('/api/optimization-suggestions/:id', async (req, res) => {
  try {
    const suggestions = await readOptimizationSuggestions()
    const index = suggestions.findIndex(s => s.id === req.params.id)
    if (index === -1) {
      return res.status(404).json({ error: 'Optimization suggestion not found' })
    }

    const updateData = { ...req.body }
    if (updateData.status === 'applied' && !suggestions[index].appliedAt) {
      updateData.appliedAt = new Date().toISOString()
    }

    suggestions[index] = {
      ...suggestions[index],
      ...updateData,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    }
    await saveOptimizationSuggestions(suggestions)
    res.json(suggestions[index])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ========== 模型（ModelConfig）管理 ==========
/**
 * @swagger
 * /api/models:
 *   get:
 *     summary: 获取模型配置
 *     tags: [Models]
 *     responses:
 *       200:
 *         description: 模型列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModelConfig'
 */
app.get('/api/models', async (req, res) => {
  try {
    const models = await readModels()
    res.json({ data: models })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/models:
 *   post:
 *     summary: 创建模型配置
 *     tags: [Models]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModelConfig'
 *     responses:
 *       200:
 *         description: 创建成功
 */
app.post('/api/models', async (req, res) => {
  try {
    const models = await readModels()
    const now = new Date().toISOString()
    const newModel = {
      id: `model_${Date.now()}`,
      name: req.body.name || '新模型',
      provider: req.body.provider || 'openai',
      baseUrl: req.body.baseUrl || 'https://api.openai.com/v1',
      apiKey: req.body.apiKey || '',
      model: req.body.model || '',
      metadata: req.body.metadata || {},
      createdAt: now,
      updatedAt: now
    }
    models.push(newModel)
    await saveModels(models)
    logger.info(`创建模型配置: ${newModel.name} (id: ${newModel.id})`)
    res.json(newModel)
  } catch (error) {
    logger.error('创建模型配置失败:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/models/{id}:
 *   put:
 *     summary: 更新模型配置
 *     tags: [Models]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModelConfig'
 *     responses:
 *       200:
 *         description: 更新成功
 */
app.put('/api/models/:id', async (req, res) => {
  try {
    const models = await readModels()
    const index = models.findIndex(model => model.id === req.params.id)
    if (index === -1) {
      return res.status(404).json({ error: 'Model not found' })
    }
    models[index] = {
      ...models[index],
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    }
    await saveModels(models)
    logger.info(`更新模型配置: ${models[index].name} (id: ${req.params.id})`)
    res.json(models[index])
  } catch (error) {
    logger.error(`更新模型配置失败 (id: ${req.params.id}):`, error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/models/{id}:
 *   delete:
 *     summary: 删除模型配置
 *     tags: [Models]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 删除完成
 */
app.delete('/api/models/:id', async (req, res) => {
  try {
    const models = await readModels()
    const modelToDelete = models.find(m => m.id === req.params.id)
    const filtered = models.filter(model => model.id !== req.params.id)
    if (filtered.length === models.length) {
      logger.warn(`删除模型配置失败: 模型不存在 (id: ${req.params.id})`)
      return res.status(404).json({ error: 'Model not found' })
    }
    await saveModels(filtered)
    logger.info(`删除模型配置: ${modelToDelete?.name || 'unknown'} (id: ${req.params.id})`)
    res.json({ success: true })
  } catch (error) {
    logger.error(`删除模型配置失败 (id: ${req.params.id}):`, error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/models/{id}/test:
 *   post:
 *     summary: 测试模型连通性
 *     description: 测试模型配置是否正确，能否正常调用模型 API
 *     tags: [Models]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 测试结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   description: 是否成功
 *                 message:
 *                   type: string
 *                   description: 测试结果消息
 *       404:
 *         description: 模型不存在
 */
app.post('/api/models/:id/test', async (req, res) => {
  const startTime = Date.now()
  try {
    const models = await readModels()
    const model = models.find(m => m.id === req.params.id)
    if (!model) {
      logger.warn(`模型测试失败: 模型不存在 (id: ${req.params.id})`)
      return res.status(404).json({ ok: false, message: 'Model not found' })
    }

    logger.info(`开始测试模型: ${model.name} (id: ${model.id}, baseUrl: ${model.baseUrl})`)

    // 验证必要字段
    if (!model.baseUrl || !model.apiKey || !model.model) {
      logger.warn(`模型测试失败: 配置不完整 (id: ${model.id}, 缺少: ${!model.baseUrl ? 'baseUrl' : ''}${!model.apiKey ? ' apiKey' : ''}${!model.model ? ' model' : ''})`)
      return res.json({
        ok: false,
        message: '模型配置不完整：缺少 baseUrl、apiKey 或 model'
      })
    }

    // 调用 OpenAI 兼容的 API 进行测试
    // 根据 DeepSeek 文档：https://api-docs.deepseek.com/zh-cn/
    // base_url 可以是：
    //   - https://api.deepseek.com（推荐，文档示例使用此格式）
    //   - https://api.deepseek.com/v1（兼容 OpenAI 格式）
    // 文档示例：curl https://api.deepseek.com/chat/completions
    // 无论 baseUrl 是否包含 /v1，都直接拼接 /chat/completions
    const baseUrlClean = model.baseUrl.replace(/\/$/, '') // 移除末尾的斜杠
    const testUrl = `${baseUrlClean}/chat/completions`

    const testPayload = {
      model: model.model,
      messages: [
        {
          role: 'user',
          content: 'who are you'
        }
      ],
      stream: false, // 明确指定非流式输出（符合文档示例）
      max_tokens: 5
    }

    try {
      // 使用原生 https 模块，支持代理配置
      const urlObj = new URL(testUrl)
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy

      let result
      if (proxyUrl && urlObj.protocol === 'https:') {
        // 通过 HTTP 代理发送 HTTPS 请求（使用 CONNECT 隧道）
        logger.debug(`使用代理: ${proxyUrl} 访问 ${testUrl}`)
        const proxy = new URL(proxyUrl)
        result = await new Promise((resolve, reject) => {
          // 第一步：通过 CONNECT 建立隧道
          const connectOptions = {
            hostname: proxy.hostname,
            port: proxy.port || 80,
            method: 'CONNECT',
            path: `${urlObj.hostname}:${urlObj.port || 443}`,
            timeout: 30000
          }

          const connectReq = http.request(connectOptions)
          connectReq.on('connect', (res, socket, head) => {
            if (res.statusCode === 200) {
              // 隧道建立成功，通过 socket 发送 HTTPS 请求
              const httpsOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${model.apiKey}`
                },
                socket: socket,
                agent: false
              }

              const httpsReq = https.request(httpsOptions, (response) => {
                let data = ''
                response.on('data', chunk => { data += chunk })
                response.on('end', () => {
                  if (response.statusCode >= 200 && response.statusCode < 300) {
                    try {
                      const json = JSON.parse(data)
                      resolve({ ok: true, data: json, status: response.statusCode })
                    } catch (e) {
                      resolve({ ok: false, message: '响应解析失败', status: response.statusCode })
                    }
                  } else {
                    try {
                      const errorJson = JSON.parse(data)
                      resolve({ ok: false, message: errorJson.error?.message || errorJson.message || `HTTP ${response.statusCode}`, status: response.statusCode })
                    } catch {
                      resolve({ ok: false, message: `HTTP ${response.statusCode}`, status: response.statusCode })
                    }
                  }
                })
              })

              httpsReq.on('error', (err) => {
                reject(new Error(`HTTPS 请求失败: ${err.message}`))
              })

              httpsReq.write(JSON.stringify(testPayload))
              httpsReq.end()
            } else {
              reject(new Error(`代理连接失败: ${res.statusCode}`))
            }
          })

          connectReq.on('error', (err) => {
            reject(new Error(`代理连接失败: ${err.message}`))
          })

          connectReq.on('timeout', () => {
            connectReq.destroy()
            reject(new Error('代理连接超时'))
          })

          connectReq.end()
        })
      } else {
        // 直接请求（无代理或 HTTP）
        logger.debug(`直接访问 ${testUrl}${proxyUrl ? ' (未使用代理)' : ''}`)
        result = await new Promise((resolve, reject) => {
          const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${model.apiKey}`
            },
            timeout: 30000
          }

          const client = urlObj.protocol === 'https:' ? https : http
          const req = client.request(options, (response) => {
            let data = ''
            response.on('data', chunk => { data += chunk })
            response.on('end', () => {
              if (response.statusCode >= 200 && response.statusCode < 300) {
                try {
                  const json = JSON.parse(data)
                  resolve({ ok: true, data: json, status: response.statusCode })
                } catch (e) {
                  resolve({ ok: false, message: '响应解析失败', status: response.statusCode })
                }
              } else {
                try {
                  const errorJson = JSON.parse(data)
                  resolve({ ok: false, message: errorJson.error?.message || errorJson.message || `HTTP ${response.statusCode}`, status: response.statusCode })
                } catch {
                  resolve({ ok: false, message: `HTTP ${response.statusCode}`, status: response.statusCode })
                }
              }
            })
          })

          req.on('error', (err) => {
            reject(new Error(`请求失败: ${err.message}`))
          })

          req.on('timeout', () => {
            req.destroy()
            reject(new Error('请求超时'))
          })

          req.write(JSON.stringify(testPayload))
          req.end()
        })
      }

      // 检查响应格式是否正确
      const duration = Date.now() - startTime
      if (result.ok && result.data && result.data.choices && Array.isArray(result.data.choices) && result.data.choices.length > 0) {
        logger.info(`模型测试成功: ${model.name} (id: ${model.id}, 耗时: ${duration}ms)`)
        return res.json({
          ok: true,
          message: '模型可用，连接测试成功',
          data: result.data  // 返回完整的 API 响应
        })
      } else if (result.ok) {
        logger.warn(`模型测试失败: API 响应格式异常 (id: ${model.id}, 耗时: ${duration}ms)`, result.data)
        return res.json({
          ok: false,
          message: 'API 响应格式异常',
          data: result.data  // 返回原始响应以便调试
        })
      } else {
        logger.error(`模型测试失败: ${model.name} (id: ${model.id}, 耗时: ${duration}ms)`, result.message)
        return res.json({
          ok: false,
          message: result.message || 'API 请求失败',
          data: result.data || null  // 如果有错误响应数据也返回
        })
      }
    } catch (fetchError) {
      // 网络错误或连接失败
      const duration = Date.now() - startTime
      logger.error(`模型测试异常: ${model.name} (id: ${model.id}, 耗时: ${duration}ms)`, fetchError.message || fetchError)
      return res.json({
        ok: false,
        message: fetchError.message || '无法连接到模型 API，请检查 baseUrl 和网络连接'
      })
    }
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message || '测试失败'
    })
  }
})

// 前端路由（SPA 支持）
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' })
  }
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'))
})

const server = app.listen(PORT, () => {
  logger.info(`CIRL server running on http://localhost:${PORT}`)
})

// 优雅关闭：确保写缓冲数据不丢失
async function gracefulShutdown(signal) {
  logger.info(`收到 ${signal} 信号，正在优雅关闭...`)

  // 关闭 HTTP 服务器，停止接收新请求
  server.close(async () => {
    logger.info('HTTP 服务器已关闭')

    // 关闭 Provider，刷新所有写缓冲
    try {
      const { closeProvider } = await import('./providers/index.js')
      await closeProvider()
      logger.info('数据已保存，Provider 已关闭')
    } catch (error) {
      logger.error('关闭 Provider 时出错:', error)
    }

    // 关闭日志流
    await closeLogger()

    process.exit(0)
  })

  // 如果 10 秒内未正常关闭，强制退出
  setTimeout(() => {
    logger.error('强制退出（超时）')
    process.exit(1)
  }, 10000)
}

// 注册信号处理器
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
