import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, '..', 'data')

// 通用数据读写函数
async function readDataFile(filename) {
  const filePath = join(dataDir, filename)
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function saveDataFile(filename, data) {
  const filePath = join(dataDir, filename)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ========== 应用（App）管理 ==========
export async function readApps() {
  return readDataFile('apps.json')
}

export async function saveApps(apps) {
  return saveDataFile('apps.json', apps)
}

// ========== 问答记录（QueryRecord）管理 ==========
export async function readQueryRecords() {
  return readDataFile('query-records.json')
}

export async function saveQueryRecords(queryRecords) {
  return saveDataFile('query-records.json', queryRecords)
}

// ========== 反馈（Feedback）管理 ==========
export async function readFeedbacks() {
  return readDataFile('feedbacks.json')
}

export async function saveFeedbacks(feedbacks) {
  return saveDataFile('feedbacks.json', feedbacks)
}

// ========== 数据集（Dataset）管理 ==========
export async function readDatasets() {
  return readDataFile('datasets.json')
}

export async function saveDatasets(datasets) {
  return saveDataFile('datasets.json', datasets)
}

// ========== 命中分析（HitAnalysis）管理 ==========
export async function readHitAnalyses() {
  return readDataFile('hit-analyses.json')
}

export async function saveHitAnalyses(hitAnalyses) {
  return saveDataFile('hit-analyses.json', hitAnalyses)
}

// ========== 效果评估（Evaluation）管理 ==========
export async function readEvaluations() {
  return readDataFile('evaluations.json')
}

export async function saveEvaluations(evaluations) {
  return saveDataFile('evaluations.json', evaluations)
}

// ========== 优化建议（OptimizationSuggestion）管理 ==========
export async function readOptimizationSuggestions() {
  return readDataFile('optimization-suggestions.json')
}

export async function saveOptimizationSuggestions(suggestions) {
  return saveDataFile('optimization-suggestions.json', suggestions)
}
