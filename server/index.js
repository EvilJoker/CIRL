import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
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
  saveOptimizationSuggestions
} from './dataManager.js'
import { calculateSimilarity, getMatchType } from './similarityService.js'
import { calculateEvaluationMetrics } from './evaluationService.js'
import { swaggerSpec } from './swagger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 10001

app.use(cors())
app.use(express.json())

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CIRL API 文档'
}))

// 静态文件服务（前端构建产物）
app.use(express.static(join(__dirname, '..', 'dist')))

function updateRecordAnalysisMetadata(record, matchType, similarity, analyzedAt) {
  record.metadata = {
    ...(record.metadata || {}),
    lastAnalyzedAt: analyzedAt,
    lastMatchType: matchType,
    lastSimilarity: similarity
  }
}

async function performHitAnalysisTask({ appId, datasetId, startDate, endDate, mode = 'full' }) {
  const datasets = await readDatasets()
  const dataset = datasets.find(d => d.id === datasetId)
  if (!dataset) {
    throw new Error('Dataset not found')
  }

  const allRecords = await readQueryRecords()
  const datasetRecords = allRecords.filter(r => dataset.queryRecordIds.includes(r.id))
  if (datasetRecords.length === 0) {
    return { count: 0, analyses: [], message: 'Dataset has no QA records' }
  }

  let queryRecords = allRecords.filter(r => r.appId === appId)
  if (startDate) {
    queryRecords = queryRecords.filter(r => new Date(r.createdAt) >= new Date(startDate))
  }
  if (endDate) {
    queryRecords = queryRecords.filter(r => new Date(r.createdAt) <= new Date(endDate))
  }

  if (queryRecords.length === 0) {
    return { count: 0, analyses: [] }
  }

  const hitAnalyses = await readHitAnalyses()
  const newAnalyses = []

  for (const record of queryRecords) {
    if (mode === 'incremental') {
      const alreadyAnalyzed = hitAnalyses.some(a => a.datasetId === datasetId && a.queryRecordId === record.id)
      if (alreadyAnalyzed) {
        continue
      }
    }

    let maxSimilarity = 0
    let matchedRecordId = null
    for (const datasetRecord of datasetRecords) {
      const similarity = calculateSimilarity(record.input, datasetRecord.input)
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity
        matchedRecordId = datasetRecord.id
      }
    }

    const matchType = getMatchType(maxSimilarity)
    const analyzedAt = new Date().toISOString()
    const analysis = {
      id: `ha_${Date.now()}_${newAnalyses.length}`,
      queryRecordId: record.id,
      datasetId,
      matchType,
      similarity: maxSimilarity,
      matchedQueryRecordId: matchedRecordId,
      createdAt: analyzedAt
    }
    newAnalyses.push(analysis)
    updateRecordAnalysisMetadata(record, matchType, maxSimilarity, analyzedAt)
  }

  if (newAnalyses.length === 0) {
    return { count: 0, analyses: [] }
  }

  hitAnalyses.push(...newAnalyses)
  await saveHitAnalyses(hitAnalyses)
  await saveQueryRecords(allRecords)

  return { count: newAnalyses.length, analyses: newAnalyses }
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
    const { appId, startDate, endDate, curated, ignored, page = 1, pageSize = 20 } = req.query
    let records = await readQueryRecords()

    // 筛选
    if (appId) {
      records = records.filter(r => r.appId === appId)
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
    res.json(newRecord)
  } catch (error) {
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
 *     summary: 创建命中分析任务（全量）
 *     description: 对指定时间范围内的所有问答记录进行命中分析
 *     tags: [HitAnalyses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appId
 *               - datasetId
 *               - startDate
 *               - endDate
 *             properties:
 *               appId:
 *                 type: string
 *                 example: app_1234567890
 *               datasetId:
 *                 type: string
 *                 example: ds_1234567890
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
 *         description: 分析完成
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: 分析的记录数
 *                 analyses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HitAnalysis'
 *       400:
 *         description: 请求参数错误
 */
app.post('/api/hit-analyses', async (req, res) => {
  try {
    const { appId, datasetId, startDate, endDate } = req.body
    if (!appId || !datasetId || !startDate || !endDate) {
      return res.status(400).json({ error: 'appId, datasetId, startDate, and endDate are required' })
    }
    const result = await performHitAnalysisTask({ appId, datasetId, startDate, endDate, mode: 'full' })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 全量命中分析（显式）
app.post('/api/hit-analyses/full', async (req, res) => {
  try {
    const { appId, datasetId, startDate, endDate } = req.body
    if (!appId || !datasetId || !startDate || !endDate) {
      return res.status(400).json({ error: 'appId, datasetId, startDate, and endDate are required' })
    }
    const result = await performHitAnalysisTask({ appId, datasetId, startDate, endDate, mode: 'full' })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/hit-analyses/incremental:
 *   post:
 *     summary: 增量命中分析
 *     description: 仅分析尚未被处理的问答记录，适合每日巡检
 *     tags: [HitAnalyses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appId
 *               - datasetId
 *             properties:
 *               appId:
 *                 type: string
 *               datasetId:
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
 *                 analyses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HitAnalysis'
 */
app.post('/api/hit-analyses/incremental', async (req, res) => {
  try {
    const { appId, datasetId } = req.body
    if (!appId || !datasetId) {
      return res.status(400).json({ error: 'appId and datasetId are required' })
    }
    const result = await performHitAnalysisTask({ appId, datasetId, mode: 'incremental' })
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
 *         name: datasetId
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
    const { appId, datasetId, startDate, endDate } = req.query
    let analyses = await readHitAnalyses()

    if (datasetId) {
      analyses = analyses.filter(a => a.datasetId === datasetId)
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
 *         name: datasetId
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
    const { appId, datasetId, startDate, endDate } = req.query
    let analyses = await readHitAnalyses()

    if (datasetId) {
      analyses = analyses.filter(a => a.datasetId === datasetId)
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

// 前端路由（SPA 支持）
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' })
  }
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'))
})

const server = app.listen(PORT, () => {
  console.log(`CIRL server running on http://localhost:${PORT}`)
})

// 优雅关闭：确保写缓冲数据不丢失
async function gracefulShutdown(signal) {
  console.log(`\n收到 ${signal} 信号，正在优雅关闭...`)

  // 关闭 HTTP 服务器，停止接收新请求
  server.close(async () => {
    console.log('HTTP 服务器已关闭')

    // 关闭 Provider，刷新所有写缓冲
    try {
      const { closeProvider } = await import('./providers/index.js')
      await closeProvider()
      console.log('数据已保存，Provider 已关闭')
    } catch (error) {
      console.error('关闭 Provider 时出错:', error)
    }

    process.exit(0)
  })

  // 如果 10 秒内未正常关闭，强制退出
  setTimeout(() => {
    console.error('强制退出（超时）')
    process.exit(1)
  }, 10000)
}

// 注册信号处理器
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
