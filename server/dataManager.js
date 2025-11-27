import { getProvider } from './providers/index.js'

// 获取当前 Provider 实例
let provider = null

/**
 * 获取 Provider 实例（懒加载）
 */
async function getProviderInstance() {
  if (!provider) {
    provider = await getProvider()
  }
  return provider
}

// ========== 应用（App）管理 ==========
export async function readApps() {
  const p = await getProviderInstance()
  return p.readApps()
}

export async function saveApps(apps) {
  const p = await getProviderInstance()
  return p.saveApps(apps)
}

// ========== 问答记录（QueryRecord）管理 ==========
export async function readQueryRecords() {
  const p = await getProviderInstance()
  return p.readQueryRecords()
}

export async function saveQueryRecords(queryRecords) {
  const p = await getProviderInstance()
  return p.saveQueryRecords(queryRecords)
}

// ========== 反馈（Feedback）管理 ==========
export async function readFeedbacks() {
  const p = await getProviderInstance()
  return p.readFeedbacks()
}

export async function saveFeedbacks(feedbacks) {
  const p = await getProviderInstance()
  return p.saveFeedbacks(feedbacks)
}

// ========== 数据集（Dataset）管理 ==========
export async function readDatasets() {
  const p = await getProviderInstance()
  return p.readDatasets()
}

export async function saveDatasets(datasets) {
  const p = await getProviderInstance()
  return p.saveDatasets(datasets)
}

// ========== 命中分析（HitAnalysis）管理 ==========
export async function readHitAnalyses() {
  const p = await getProviderInstance()
  return p.readHitAnalyses()
}

export async function saveHitAnalyses(hitAnalyses) {
  const p = await getProviderInstance()
  return p.saveHitAnalyses(hitAnalyses)
}

// ========== 效果评估（Evaluation）管理 ==========
export async function readEvaluations() {
  const p = await getProviderInstance()
  return p.readEvaluations()
}

export async function saveEvaluations(evaluations) {
  const p = await getProviderInstance()
  return p.saveEvaluations(evaluations)
}

// ========== 优化建议（OptimizationSuggestion）管理 ==========
export async function readOptimizationSuggestions() {
  const p = await getProviderInstance()
  return p.readOptimizationSuggestions()
}

export async function saveOptimizationSuggestions(suggestions) {
  const p = await getProviderInstance()
  return p.saveOptimizationSuggestions(suggestions)
}

// ========== 模型（ModelConfig）管理 ==========
export async function readModels() {
  const p = await getProviderInstance()
  return p.readModels()
}

export async function saveModels(models) {
  const p = await getProviderInstance()
  return p.saveModels(models)
}

// ========== 统计（Stats）==========
export async function getRequestStats(appIds = []) {
  const p = await getProviderInstance()
  if (typeof p.getRequestStats !== 'function') {
    throw new Error('Current provider does not implement getRequestStats')
  }
  return p.getRequestStats(appIds)
}
