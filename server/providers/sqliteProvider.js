import { BaseProvider } from './baseProvider.js'
import { WriteBuffer } from './writeBuffer.js'
import { getTimelineConfigs, ensureStatsEntry, assignTimelineFromMap, upsertValue } from './statsUtils.js'
import initSqlJs from 'sql.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { writeFile } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dbPath = join(__dirname, '..', '..', 'data', 'cirl.db')
const dataDir = join(__dirname, '..', '..', 'data')
const STATS_CACHE_TTL_MS = 5 * 60 * 1000

function createStatsCacheKey(appIds = []) {
  if (!appIds || appIds.length === 0) {
    return 'all'
  }
  return [...appIds].sort().join(',')
}

/**
 * SQLite Provider（使用 sql.js，纯 JavaScript，无需编译）
 */
export class SqliteProvider extends BaseProvider {
  constructor(options = {}) {
    super()
    this.SQL = null
    this.db = null
    this.initialized = false

    // 写缓冲配置
    this.writeBufferConfig = {
      batchSize: options.writeBufferBatchSize || parseInt(process.env.WRITE_BUFFER_BATCH_SIZE || '100'),
      flushInterval: options.writeBufferFlushInterval || parseInt(process.env.WRITE_BUFFER_FLUSH_INTERVAL || '5000')
    }

    // 问答记录写缓冲
    this.queryRecordsBuffer = new WriteBuffer(this.writeBufferConfig)
    this.queryRecordsBuffer.setWriteCallback(this.flushQueryRecords.bind(this))

    // 待保存的数据库操作队列（用于批量保存）
    this.pendingSaveOperations = []
    this.saveTimer = null
    this.saveInterval = 2000 // 2秒保存一次数据库文件

    // 统计缓存：不持久化，内存保留 5 分钟
    this.statsCache = null
  }

  /**
   * 初始化 SQL.js
   */
  async initSQL() {
    if (!this.SQL) {
      // 尝试从本地加载 wasm 文件，如果不存在则从 CDN 下载
      this.SQL = await initSqlJs({
        locateFile: (file) => {
          // 优先使用本地文件
          const localPath = join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file)
          if (existsSync(localPath)) {
            return localPath
          }
          // 回退到 CDN
          return `https://sql.js.org/dist/${file}`
        }
      })
    }
    return this.SQL
  }

  /**
   * 初始化数据库
   */
  async initialize() {
    if (this.initialized) {
      return
    }

    // 确保 data 目录存在
    if (!existsSync(dataDir)) {
      throw new Error(`Data directory does not exist: ${dataDir}`)
    }

    // 初始化 SQL.js
    const SQLInstance = await this.initSQL()

    const dbExists = existsSync(dbPath)

    if (dbExists) {
      // 从文件加载数据库
      const buffer = readFileSync(dbPath)
      this.db = new SQLInstance.Database(buffer)
      console.log('✓ SQLite 数据库已加载')
    } else {
      // 创建新数据库
      this.db = new SQLInstance.Database()
      console.log('✓ 新 SQLite 数据库已创建')
    }

    // 启用外键约束
    this.db.run('PRAGMA foreign_keys = ON')

    this.ensureModelsTable()

    // 检查表是否存在，如果不存在则初始化 schema
    const tablesExist = this.checkTablesExist()
    if (!tablesExist) {
      console.log('检测到数据库表不存在，正在初始化...')
      this.initializeSchema()
      await this.saveDatabase() // 异步保存
      console.log('✓ 数据库表已初始化')
    }

    this.initialized = true
  }

  /**
   * 保存数据库到文件（异步）
   */
  async saveDatabase() {
    if (this.db) {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      await writeFile(dbPath, buffer)
    }
  }

  /**
   * 标记需要保存数据库（延迟保存，减少 I/O）
   */
  markDirty() {
    // 如果定时器已启动，不重复启动
    if (this.saveTimer) {
      return
    }

    // 延迟保存，合并多次写入
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null
      try {
        await this.saveDatabase()
      } catch (error) {
        console.error('保存数据库失败:', error)
      }
    }, this.saveInterval)
  }

  /**
   * 检查数据库表是否存在
   */
  checkTablesExist() {
    try {
      const result = this.db.exec(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='apps'
      `)
      return result.length > 0 && result[0].values.length > 0
    } catch (error) {
      console.warn('检查表是否存在时出错:', error)
      return false
    }
  }

  /**
   * 初始化数据库 schema
   */
  initializeSchema() {
    // 应用表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS apps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // 问答记录表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS query_records (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        model_id TEXT,
        context TEXT,
        curated INTEGER DEFAULT 0,
        tags TEXT,
        ignored INTEGER DEFAULT 0,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      )
    `)

    // 创建索引
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_query_records_app_id ON query_records(app_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_query_records_created_at ON query_records(created_at)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_query_records_curated ON query_records(curated)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_query_records_ignored ON query_records(ignored)`)

    // 反馈表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id TEXT PRIMARY KEY,
        query_record_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('positive', 'negative', 'neutral', 'correction')),
        content TEXT,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        correction TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processed', 'resolved')),
        processed_at TEXT,
        resolution TEXT,
        optimization_suggestion TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (query_record_id) REFERENCES query_records(id) ON DELETE CASCADE
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_feedbacks_query_record_id ON feedbacks(query_record_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status)`)

    // 数据集表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      )
    `)

    // 数据集与问答记录的关联表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS dataset_query_records (
        dataset_id TEXT NOT NULL,
        query_record_id TEXT NOT NULL,
        PRIMARY KEY (dataset_id, query_record_id),
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
        FOREIGN KEY (query_record_id) REFERENCES query_records(id) ON DELETE CASCADE
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_datasets_app_id ON datasets(app_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_dataset_query_records_dataset_id ON dataset_query_records(dataset_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_dataset_query_records_query_record_id ON dataset_query_records(query_record_id)`)

    // 命中分析表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS hit_analyses (
        id TEXT PRIMARY KEY,
        query_record_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        match_type TEXT NOT NULL CHECK(match_type IN ('exact', 'high', 'medium', 'none')),
        similarity REAL NOT NULL CHECK(similarity >= 0 AND similarity <= 100),
        matched_query_record_id TEXT,
        analysis_result TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (query_record_id) REFERENCES query_records(id) ON DELETE CASCADE,
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_hit_analyses_query_record_id ON hit_analyses(query_record_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_hit_analyses_dataset_id ON hit_analyses(dataset_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_hit_analyses_match_type ON hit_analyses(match_type)`)

    // 效果评估表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        evaluation_type TEXT NOT NULL CHECK(evaluation_type IN ('before', 'after')),
        metrics TEXT NOT NULL,
        evaluated_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
      )
    `)

    // 评估与问答记录的关联表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS evaluation_query_records (
        evaluation_id TEXT NOT NULL,
        query_record_id TEXT NOT NULL,
        PRIMARY KEY (evaluation_id, query_record_id),
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
        FOREIGN KEY (query_record_id) REFERENCES query_records(id) ON DELETE CASCADE
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_evaluations_app_id ON evaluations(app_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_evaluations_dataset_id ON evaluations(dataset_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_evaluations_evaluation_type ON evaluations(evaluation_type)`)

    // 优化建议表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS optimization_suggestions (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('feedback', 'hit-analysis', 'evaluation')),
        source_id TEXT NOT NULL,
        priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')),
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'applied', 'rejected')),
        applied_at TEXT,
        result TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_optimization_suggestions_app_id ON optimization_suggestions(app_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_optimization_suggestions_status ON optimization_suggestions(status)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_optimization_suggestions_source ON optimization_suggestions(source)`)

    this.ensureModelsTable()
  }

  ensureModelsTable() {
    if (!this.db) return
    this.db.run(`
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        base_url TEXT,
        api_key TEXT,
        model TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
  }

  // ========== 辅助函数 ==========

  /**
   * 序列化 JSON 对象为字符串
   */
  serializeJSON(obj) {
    if (obj === null || obj === undefined) {
      return null
    }
    return JSON.stringify(obj)
  }

  /**
   * 反序列化 JSON 字符串为对象
   */
  deserializeJSON(str) {
    if (!str) {
      return null
    }
    try {
      return JSON.parse(str)
    } catch {
      return null
    }
  }

  /**
   * 序列化数组为 JSON 字符串
   */
  serializeArray(arr) {
    if (!arr || arr.length === 0) {
      return null
    }
    return JSON.stringify(arr)
  }

  /**
   * 反序列化 JSON 字符串为数组
   */
  deserializeArray(str) {
    if (!str) {
      return []
    }
    try {
      return JSON.parse(str)
    } catch {
      return []
    }
  }

  /**
   * 转换布尔值为整数
   */
  boolToInt(bool) {
    return bool ? 1 : 0
  }

  /**
   * 转换整数为布尔值
   */
  intToBool(int) {
    return int === 1
  }

  /**
   * 执行查询并返回结果（单行）
   */
  query(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    const stmt = this.db.prepare(sql)
    if (params && params.length > 0) {
      stmt.bind(params)
    }
    const hasResult = stmt.step()
    let result = null
    if (hasResult) {
      result = stmt.getAsObject()
    }
    stmt.free()
    return result
  }

  /**
   * 执行查询并返回所有结果
   */
  queryAll(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    const stmt = this.db.prepare(sql)
    if (params && params.length > 0) {
      stmt.bind(params)
    }
    const results = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    return results
  }

  /**
   * 执行更新操作
   */
  execute(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    const stmt = this.db.prepare(sql)
    if (params && params.length > 0) {
      stmt.bind(params)
    }
    stmt.step()
    stmt.free()
    this.markDirty() // 标记需要保存，延迟写入
  }

  /**
   * 执行批量操作
   */
  executeBatch(operations) {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    for (const { sql, params } of operations) {
      const stmt = this.db.prepare(sql)
      if (params && params.length > 0) {
        stmt.bind(params)
      }
      stmt.step()
      stmt.free()
    }
    this.markDirty() // 标记需要保存，延迟写入
  }

  // ========== 应用（App）管理 ==========
  async readApps() {
    await this.ensureInitialized()
    const rows = this.queryAll('SELECT * FROM apps ORDER BY created_at DESC')
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      metadata: this.deserializeJSON(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  async saveApps(apps) {
    await this.ensureInitialized()
    const operations = []

    // 使用 UPSERT 策略（INSERT OR REPLACE）
    for (const app of apps) {
      operations.push({
        sql: `INSERT OR REPLACE INTO apps (id, name, description, metadata, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          app.id,
          app.name,
          app.description || null,
          this.serializeJSON(app.metadata),
          app.createdAt,
          app.updatedAt
        ]
      })
    }

    this.executeBatch(operations)
  }

  // ========== 问答记录（QueryRecord）管理 ==========
  async readQueryRecords() {
    await this.ensureInitialized()

    // 读取前先刷新缓冲区，确保数据最新
    await this.queryRecordsBuffer.flush()

    const rows = this.queryAll('SELECT * FROM query_records ORDER BY created_at DESC')
    return rows.map(row => ({
      id: row.id,
      appId: row.app_id,
      input: row.input,
      output: row.output,
      modelId: row.model_id || undefined,
      context: this.deserializeJSON(row.context),
      curated: this.intToBool(row.curated),
      tags: this.deserializeArray(row.tags),
      ignored: this.intToBool(row.ignored),
      metadata: this.deserializeJSON(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  /**
   * 保存问答记录（使用写缓冲）
   */
  async saveQueryRecords(queryRecords) {
    await this.ensureInitialized()

    // 如果是完整替换（通常是从其他地方加载），直接写入
    // 如果是新增记录，使用写缓冲
    if (queryRecords.length > this.writeBufferConfig.batchSize) {
      // 大批量数据，直接写入
      await this.flushQueryRecords(queryRecords)
    } else {
      // 小批量或单个记录，使用写缓冲
      for (const record of queryRecords) {
        await this.queryRecordsBuffer.add(record)
      }
    }
  }

  /**
   * 刷新问答记录缓冲区（批量写入）
   */
  async flushQueryRecords(records) {
    if (!records || records.length === 0) {
      return
    }

    await this.ensureInitialized()

    // 使用 UPSERT 策略（INSERT OR REPLACE）
    const operations = []
    for (const record of records) {
      operations.push({
        sql: `INSERT OR REPLACE INTO query_records (
          id, app_id, input, output, model_id, context, curated, tags, ignored, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          record.id,
          record.appId,
          record.input,
          record.output,
          record.modelId || null,
          this.serializeJSON(record.context),
          this.boolToInt(record.curated || false),
          this.serializeArray(record.tags),
          this.boolToInt(record.ignored || false),
          this.serializeJSON(record.metadata),
          record.createdAt,
          record.updatedAt
        ]
      })
    }

    this.executeBatch(operations)
  }

  // ========== 反馈（Feedback）管理 ==========
  async readFeedbacks() {
    await this.ensureInitialized()
    const rows = this.queryAll('SELECT * FROM feedbacks ORDER BY created_at DESC')
    return rows.map(row => ({
      id: row.id,
      queryRecordId: row.query_record_id,
      type: row.type,
      content: row.content || undefined,
      rating: row.rating || undefined,
      correction: row.correction || undefined,
      status: row.status,
      processedAt: row.processed_at || undefined,
      resolution: row.resolution || undefined,
      optimizationSuggestion: row.optimization_suggestion || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  async saveFeedbacks(feedbacks) {
    await this.ensureInitialized()
    const operations = []

    // 使用 UPSERT 策略（INSERT OR REPLACE）
    for (const feedback of feedbacks) {
      operations.push({
        sql: `INSERT OR REPLACE INTO feedbacks (
          id, query_record_id, type, content, rating, correction, status,
          processed_at, resolution, optimization_suggestion, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          feedback.id,
          feedback.queryRecordId,
          feedback.type,
          feedback.content || null,
          feedback.rating || null,
          feedback.correction || null,
          feedback.status,
          feedback.processedAt || null,
          feedback.resolution || null,
          feedback.optimizationSuggestion || null,
          feedback.createdAt,
          feedback.updatedAt
        ]
      })
    }

    this.executeBatch(operations)
  }

  // ========== 数据集（Dataset）管理 ==========
  async readDatasets() {
    await this.ensureInitialized()
    const rows = this.queryAll('SELECT * FROM datasets ORDER BY created_at DESC')

    // 获取每个数据集的 queryRecordIds
    const datasets = []
    for (const row of rows) {
      const queryRecordIdsRows = this.queryAll(
        'SELECT query_record_id FROM dataset_query_records WHERE dataset_id = ?',
        [row.id]
      )
      const queryRecordIds = queryRecordIdsRows.map(r => r.query_record_id)

      datasets.push({
        id: row.id,
        appId: row.app_id,
        name: row.name,
        description: row.description || undefined,
        queryRecordIds,
        metadata: this.deserializeJSON(row.metadata),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })
    }

    return datasets
  }

  async saveDatasets(datasets) {
    await this.ensureInitialized()
    const operations = []

    // 收集所有需要保留的数据集 ID
    const datasetIds = new Set(datasets.map(d => d.id))

    // 删除不再存在的关联关系（只删除不在新数据集列表中的关联）
    if (datasetIds.size > 0) {
      const placeholders = Array(datasetIds.size).fill('?').join(',')
      operations.push({
        sql: `DELETE FROM dataset_query_records WHERE dataset_id NOT IN (${placeholders})`,
        params: Array.from(datasetIds)
      })
    } else {
      // 如果新数据集列表为空，删除所有关联关系
      operations.push({ sql: 'DELETE FROM dataset_query_records', params: [] })
    }

    for (const dataset of datasets) {
      // 使用 UPSERT 策略插入数据集
      operations.push({
        sql: `INSERT OR REPLACE INTO datasets (id, app_id, name, description, metadata, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          dataset.id,
          dataset.appId,
          dataset.name,
          dataset.description || null,
          this.serializeJSON(dataset.metadata),
          dataset.createdAt,
          dataset.updatedAt
        ]
      })

      // 删除该数据集的所有旧关联关系，然后插入新的
      operations.push({
        sql: `DELETE FROM dataset_query_records WHERE dataset_id = ?`,
        params: [dataset.id]
      })

      // 插入关联关系
      if (dataset.queryRecordIds && dataset.queryRecordIds.length > 0) {
        for (const queryRecordId of dataset.queryRecordIds) {
          operations.push({
            sql: `INSERT OR IGNORE INTO dataset_query_records (dataset_id, query_record_id)
                  VALUES (?, ?)`,
            params: [dataset.id, queryRecordId]
          })
        }
      }
    }

    this.executeBatch(operations)
  }

  // ========== 命中分析（HitAnalysis）管理 ==========
  async readHitAnalyses() {
    await this.ensureInitialized()
    const rows = this.queryAll('SELECT * FROM hit_analyses ORDER BY created_at DESC')
    return rows.map(row => ({
      id: row.id,
      queryRecordId: row.query_record_id,
      datasetId: row.dataset_id,
      matchType: row.match_type,
      similarity: row.similarity,
      matchedQueryRecordId: row.matched_query_record_id || undefined,
      analysisResult: this.deserializeJSON(row.analysis_result) || row.analysis_result || undefined,
      createdAt: row.created_at
    }))
  }

  async saveHitAnalyses(hitAnalyses) {
    await this.ensureInitialized()
    const operations = []

    // 使用 UPSERT 策略（INSERT OR REPLACE）
    for (const analysis of hitAnalyses) {
      const analysisResultValue =
        analysis.analysisResult && typeof analysis.analysisResult === 'object'
          ? this.serializeJSON(analysis.analysisResult)
          : analysis.analysisResult || null

      operations.push({
        sql: `INSERT OR REPLACE INTO hit_analyses (
          id, query_record_id, dataset_id, match_type, similarity,
          matched_query_record_id, analysis_result, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          analysis.id,
          analysis.queryRecordId,
          analysis.datasetId,
          analysis.matchType,
          analysis.similarity,
          analysis.matchedQueryRecordId || null,
          analysisResultValue,
          analysis.createdAt
        ]
      })
    }

    this.executeBatch(operations)
  }

  // ========== 效果评估（Evaluation）管理 ==========
  async readEvaluations() {
    await this.ensureInitialized()
    const rows = this.queryAll('SELECT * FROM evaluations ORDER BY created_at DESC')

    const evaluations = []
    for (const row of rows) {
      const queryRecordIdsRows = this.queryAll(
        'SELECT query_record_id FROM evaluation_query_records WHERE evaluation_id = ?',
        [row.id]
      )
      const queryRecordIds = queryRecordIdsRows.map(r => r.query_record_id)

      evaluations.push({
        id: row.id,
        appId: row.app_id,
        datasetId: row.dataset_id,
        evaluationType: row.evaluation_type,
        metrics: this.deserializeJSON(row.metrics),
        queryRecordIds,
        evaluatedAt: row.evaluated_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })
    }

    return evaluations
  }

  async saveEvaluations(evaluations) {
    await this.ensureInitialized()
    const operations = []

    // 收集所有需要保留的评估 ID
    const evaluationIds = new Set(evaluations.map(e => e.id))

    // 删除不再存在的关联关系
    if (evaluationIds.size > 0) {
      const placeholders = Array(evaluationIds.size).fill('?').join(',')
      operations.push({
        sql: `DELETE FROM evaluation_query_records WHERE evaluation_id NOT IN (${placeholders})`,
        params: Array.from(evaluationIds)
      })
    } else {
      operations.push({ sql: 'DELETE FROM evaluation_query_records', params: [] })
    }

    for (const evaluation of evaluations) {
      // 使用 UPSERT 策略插入评估
      operations.push({
        sql: `INSERT OR REPLACE INTO evaluations (
          id, app_id, dataset_id, evaluation_type, metrics, evaluated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          evaluation.id,
          evaluation.appId,
          evaluation.datasetId,
          evaluation.evaluationType,
          this.serializeJSON(evaluation.metrics),
          evaluation.evaluatedAt,
          evaluation.createdAt,
          evaluation.updatedAt
        ]
      })

      // 删除该评估的所有旧关联关系，然后插入新的
      operations.push({
        sql: `DELETE FROM evaluation_query_records WHERE evaluation_id = ?`,
        params: [evaluation.id]
      })

      // 插入关联关系
      if (evaluation.queryRecordIds && evaluation.queryRecordIds.length > 0) {
        for (const queryRecordId of evaluation.queryRecordIds) {
          operations.push({
            sql: `INSERT OR IGNORE INTO evaluation_query_records (evaluation_id, query_record_id)
                  VALUES (?, ?)`,
            params: [evaluation.id, queryRecordId]
          })
        }
      }
    }

    this.executeBatch(operations)
  }

  // ========== 优化建议（OptimizationSuggestion）管理 ==========
  async readOptimizationSuggestions() {
    await this.ensureInitialized()
    const rows = this.queryAll('SELECT * FROM optimization_suggestions ORDER BY created_at DESC')
    return rows.map(row => ({
      id: row.id,
      appId: row.app_id,
      source: row.source,
      sourceId: row.source_id,
      priority: row.priority,
      content: row.content,
      status: row.status,
      appliedAt: row.applied_at || undefined,
      result: row.result || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  async saveOptimizationSuggestions(suggestions) {
    await this.ensureInitialized()
    const operations = []

    // 使用 UPSERT 策略（INSERT OR REPLACE）
    for (const suggestion of suggestions) {
      operations.push({
        sql: `INSERT OR REPLACE INTO optimization_suggestions (
          id, app_id, source, source_id, priority, content, status,
          applied_at, result, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          suggestion.id,
          suggestion.appId,
          suggestion.source,
          suggestion.sourceId,
          suggestion.priority,
          suggestion.content,
          suggestion.status,
          suggestion.appliedAt || null,
          suggestion.result || null,
          suggestion.createdAt,
          suggestion.updatedAt
        ]
      })
    }

    this.executeBatch(operations)
  }

  // ========== 模型（ModelConfig）管理 ==========
  async readModels() {
    await this.ensureInitialized()
    this.ensureModelsTable()
    const rows = this.queryAll('SELECT * FROM models ORDER BY created_at DESC')
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      provider: row.provider,
      baseUrl: row.base_url || '',
      apiKey: row.api_key || '',
      model: row.model,
      metadata: this.deserializeJSON(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  async saveModels(models) {
    await this.ensureInitialized()
    this.ensureModelsTable()
    const operations = []

    if (models.length === 0) {
      operations.push({ sql: 'DELETE FROM models', params: [] })
    } else {
      const placeholders = models.map(() => '?').join(',')
      operations.push({
        sql: `DELETE FROM models WHERE id NOT IN (${placeholders})`,
        params: models.map(m => m.id)
      })
    }

    for (const model of models) {
      operations.push({
        sql: `INSERT OR REPLACE INTO models (
          id, name, provider, base_url, api_key, model, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          model.id,
          model.name,
          model.provider,
          model.baseUrl || null,
          model.apiKey || null,
          model.model,
          this.serializeJSON(model.metadata || null),
          model.createdAt,
          model.updatedAt
        ]
      })
    }

    this.executeBatch(operations)
  }

  // ========== 统计（Stats）==========
  /**
   * 获取请求统计信息（带 5 分钟内存缓存）
   * @param {string[]} appIds - 应用ID列表，为空则统计所有应用
   * @returns {Promise<Object>} 统计信息
   */
  async getRequestStats(appIds = []) {
    const cacheKey = createStatsCacheKey(appIds)
    const cacheTimestamp = Date.now()

    await this.ensureInitialized()

    if (this.statsCache && this.statsCache.key === cacheKey && this.statsCache.expiresAt > cacheTimestamp) {
      return this.statsCache.data
    }

    // 刷新缓冲区，确保数据最新
    await this.queryRecordsBuffer.flush()

    const referenceTime = new Date()
    const timelineConfigs = getTimelineConfigs(referenceTime)

    // 构建 WHERE 条件
    // 注意：每个查询的时间条件不同，需要分别构建
    const buildWhereClause = (appIds, timeParam) => {
      const conditions = []
      const params = []

      if (appIds.length > 0) {
        const placeholders = appIds.map(() => '?').join(',')
        conditions.push(`app_id IN (${placeholders})`)
        params.push(...appIds)
      }

      conditions.push('created_at >= ?')
      params.push(timeParam)

      conditions.push('ignored = 0')

      return {
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        params
      }
    }

    const result = {}

    for (const config of timelineConfigs) {
      const clause = buildWhereClause(appIds, config.sinceIso)
      config.whereClause = clause.whereClause
      config.params = clause.params

      const rows = this.queryAll(`
        SELECT app_id, COUNT(*) as count
        FROM query_records
        ${config.whereClause}
        GROUP BY app_id
      `, config.params)

      for (const row of rows) {
        const entry = ensureStatsEntry(result, row.app_id)
        entry[config.countKey] = row.count || 0
      }
    }

    if (appIds.length > 0) {
      for (const appId of appIds) {
        ensureStatsEntry(result, appId)
      }
    }

    for (const config of timelineConfigs) {
      const timelineRows = this.queryAll(`
        SELECT app_id,
          strftime('${config.strftimeFormat}', datetime(created_at, 'utc')) as bucket,
          COUNT(*) as count
        FROM query_records
        ${config.whereClause}
        GROUP BY app_id, bucket
      `, config.params)

      const valueMap = new Map()
      for (const row of timelineRows) {
        if (!row.bucket) continue
        upsertValue(valueMap, row.app_id, row.bucket, row.count || 0)
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

  /**
   * 确保数据库已初始化
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    // 刷新所有写缓冲
    await this.queryRecordsBuffer.close()

    // 清除保存定时器
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }

    // 保存数据库
    if (this.db) {
      await this.saveDatabase()
      this.db.close()
      this.db = null
      this.initialized = false
    }
  }
}

