import { BaseProvider } from './baseProvider.js'
import {
  getTimelineConfigs,
  ensureStatsEntry,
  assignTimelineFromMap,
  incrementBucket
} from './statsUtils.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, '..', '..', 'data')
const STATS_CACHE_TTL_MS = 5 * 60 * 1000

function createStatsCacheKey(appIds = []) {
  if (!appIds || appIds.length === 0) {
    return 'all'
  }
  return [...appIds].sort().join(',')
}

// ========== 文件锁机制 ==========
const fileLocks = new Map()

/**
 * 获取文件锁（支持读写锁）
 */
async function acquireLock(filename, isWrite = false) {
  if (!fileLocks.has(filename)) {
    fileLocks.set(filename, {
      readers: 0,
      writer: null,
      queue: []
    })
  }

  const lock = fileLocks.get(filename)

  return new Promise((resolve) => {
    const acquire = () => {
      if (isWrite) {
        if (lock.readers === 0 && lock.writer === null) {
          lock.writer = true
          resolve(() => {
            lock.writer = null
            if (lock.queue.length > 0) {
              const next = lock.queue.shift()
              next()
            }
          })
        } else {
          lock.queue.push(acquire)
        }
      } else {
        if (lock.writer === null) {
          lock.readers++
          resolve(() => {
            lock.readers--
            if (lock.readers === 0 && lock.queue.length > 0) {
              const next = lock.queue.shift()
              next()
            }
          })
        } else {
          lock.queue.push(acquire)
        }
      }
    }
    acquire()
  })
}

/**
 * 读取 JSON 文件
 */
async function readJSONFile(filename) {
  const filePath = join(dataDir, filename)
  const release = await acquireLock(filename, false)
  try {
    if (!existsSync(filePath)) {
      return []
    }
    const data = await fs.readFile(filePath, 'utf-8')
    if (!data.trim()) {
      return []
    }
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  } finally {
    release()
  }
}

/**
 * 保存 JSON 文件
 */
async function saveJSONFile(filename, data) {
  const filePath = join(dataDir, filename)
  const release = await acquireLock(filename, true)
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } finally {
    release()
  }
}

/**
 * JSON 文件 Provider
 */
export class JsonProvider extends BaseProvider {
  constructor() {
    super()
    // 统计缓存：不持久化，内存保留 5 分钟
    this.statsCache = null
  }
  // ========== 应用（App）管理 ==========
  async readApps() {
    return readJSONFile('apps.json')
  }

  async saveApps(apps) {
    return saveJSONFile('apps.json', apps)
  }

  // ========== 问答记录（QueryRecord）管理 ==========
  async readQueryRecords() {
    return readJSONFile('query-records.json')
  }

  async saveQueryRecords(queryRecords) {
    return saveJSONFile('query-records.json', queryRecords)
  }

  // ========== 反馈（Feedback）管理 ==========
  async readFeedbacks() {
    return readJSONFile('feedbacks.json')
  }

  async saveFeedbacks(feedbacks) {
    return saveJSONFile('feedbacks.json', feedbacks)
  }

  // ========== 数据集（Dataset）管理 ==========
  async readDatasets() {
    return readJSONFile('datasets.json')
  }

  async saveDatasets(datasets) {
    return saveJSONFile('datasets.json', datasets)
  }

  // ========== 命中分析（HitAnalysis）管理 ==========
  async readHitAnalyses() {
    return readJSONFile('hit-analyses.json')
  }

  async saveHitAnalyses(hitAnalyses) {
    return saveJSONFile('hit-analyses.json', hitAnalyses)
  }

  // ========== 效果评估（Evaluation）管理 ==========
  async readEvaluations() {
    return readJSONFile('evaluations.json')
  }

  async saveEvaluations(evaluations) {
    return saveJSONFile('evaluations.json', evaluations)
  }

  // ========== 优化建议（OptimizationSuggestion）管理 ==========
  async readOptimizationSuggestions() {
    return readJSONFile('optimization-suggestions.json')
  }

  async saveOptimizationSuggestions(suggestions) {
    return saveJSONFile('optimization-suggestions.json', suggestions)
  }

  // ========== 模型（ModelConfig）管理 ==========
  async readModels() {
    return readJSONFile('models.json')
  }

  async saveModels(models) {
    return saveJSONFile('models.json', models)
  }

  // ========== 统计（Stats）==========
  /**
   * 获取请求统计信息（实时计算，命中缓存则复用）
   * @param {string[]} appIds - 应用ID列表，为空则统计所有应用
   * @returns {Promise<Object>} 统计信息
   */
  async getRequestStats(appIds = []) {
    const cacheKey = createStatsCacheKey(appIds)
    const cacheTimestamp = Date.now()
    if (this.statsCache && this.statsCache.key === cacheKey && this.statsCache.expiresAt > cacheTimestamp) {
      return this.statsCache.data
    }

    const allRecords = await this.readQueryRecords()

    const referenceTime = new Date()
    const timelineConfigs = getTimelineConfigs(referenceTime)

    // 过滤记录
    let filteredRecords = allRecords.filter(r => !r.ignored)
    if (appIds.length > 0) {
      filteredRecords = filteredRecords.filter(r => appIds.includes(r.appId))
    }

    const result = {}

    for (const record of filteredRecords) {
      const appId = record.appId
      const entry = ensureStatsEntry(result, appId)

      const createdAt = new Date(record.createdAt)

      for (const config of timelineConfigs) {
        if (createdAt >= config.since) {
          entry[config.countKey]++
        }
      }
    }

    // 如果指定了 appIds，确保所有应用都有统计（即使为0）
    if (appIds.length > 0) {
      for (const appId of appIds) {
        ensureStatsEntry(result, appId)
      }
    }

    for (const config of timelineConfigs) {
      const valueMap = new Map()
      for (const record of filteredRecords) {
        const createdAt = new Date(record.createdAt)
        if (createdAt < config.since) continue
        const bucketDate = config.alignFn(new Date(createdAt))
        const bucketIso = bucketDate.toISOString()
        incrementBucket(valueMap, record.appId, bucketIso)
      }

      assignTimelineFromMap(result, appIds, config.timelineKey, config.buckets, valueMap)
    }

    this.statsCache = {
      key: cacheKey,
      data: result,
      expiresAt: cacheTimestamp + STATS_CACHE_TTL_MS
    }

    return result
  }
}


