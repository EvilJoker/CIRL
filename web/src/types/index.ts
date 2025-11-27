// 应用（App）
export interface App {
  id: string
  name: string
  description?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// 问答记录
export interface QueryRecord {
  id: string
  appId: string // 关联的应用ID
  input: string // 用户输入的问题
  output: string // 应用输出的回答
  modelId?: string // 使用的模型标识（可选）
  context?: Record<string, any> // 上下文信息
  curated?: boolean
  tags?: string[]
  ignored?: boolean
  metadata?: {
    responseTime?: number
    lastAnalyzedAt?: string
    lastMatchType?: 'exact' | 'high' | 'medium' | 'none'
    lastSimilarity?: number
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
}

// 反馈
export interface Feedback {
  id: string
  queryRecordId: string
  type: 'positive' | 'negative' | 'neutral' | 'correction'
  content?: string // 反馈内容
  rating?: number // 评分 1-5
  correction?: string // 纠正后的答案（如果 type 是 correction）
  status: 'pending' | 'processed' | 'resolved'
  processedAt?: string
  resolution?: string // 处理方案
  optimizationSuggestion?: string // 优化建议
  createdAt: string
  updatedAt: string
}

// 数据集
export interface Dataset {
  id: string
  appId: string // 关联的应用ID
  name: string
  description?: string
  queryRecordIds: string[] // 包含的问答记录ID列表（作为标准答案集）
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// 命中分析
export interface HitAnalysis {
  id: string
  queryRecordId: string
  datasetId: string
  matchType: 'exact' | 'high' | 'medium' | 'none' // 完全命中、80%相似、60%相似、未命中
  similarity: number // 相似度 0-100
  matchedQueryRecordId?: string // 匹配到的数据集中的问答记录ID
  analysisResult?: {
    range?: '24h' | '7d' | '30d'
    modelId?: string | null
    appId?: string
    [key: string]: any
  } // 额外元数据
  createdAt: string
}

export interface HitAnalysisSummary {
  exact: number
  high: number
  medium: number
  none: number
  total: number
}

export interface ModelConfig {
  id: string
  name: string
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// 效果评估
export interface Evaluation {
  id: string
  appId: string
  datasetId: string
  evaluationType: 'before' | 'after' // 优化前或优化后
  metrics: {
    accuracy: number // 准确率（优先级最高）
    speed: number // 速度（毫秒）
    exactHitRate: number // 完全命中率
    highHitRate: number // 80%相似命中率
    mediumHitRate: number // 60%相似命中率
    noHitRate: number // 未命中率
    avgRating: number // 平均评分
    feedbackCount: number // 反馈数量
  }
  queryRecordIds: string[] // 参与评估的问答记录
  evaluatedAt: string
  createdAt: string
  updatedAt: string
}

// 优化建议
export interface OptimizationSuggestion {
  id: string
  appId: string
  source: 'feedback' | 'hit-analysis' | 'evaluation' // 来源：反馈、命中分析、评估
  sourceId: string // 来源ID（feedbackId、hitAnalysisId、evaluationId）
  priority: 'high' | 'medium' | 'low'
  content: string // 优化建议内容
  status: 'pending' | 'applied' | 'rejected'
  appliedAt?: string
  result?: string // 应用结果
  createdAt: string
  updatedAt: string
}
