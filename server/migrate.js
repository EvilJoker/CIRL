import { readFileSync, existsSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { closeProvider } from './providers/index.js'
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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, '..', 'data')

/**
 * 从 JSON 文件读取数据
 */
function readJSONFile(filename) {
  const filePath = join(dataDir, filename)
  if (!existsSync(filePath)) {
    console.log(`文件不存在，跳过: ${filename}`)
    return []
  }
  try {
    const content = readFileSync(filePath, 'utf-8')
    if (!content.trim()) {
      return []
    }
    return JSON.parse(content)
  } catch (error) {
    console.error(`读取文件失败 ${filename}:`, error.message)
    return []
  }
}

/**
 * 备份 JSON 文件
 */
function backupJSONFile(filename) {
  const filePath = join(dataDir, filename)
  const backupPath = join(dataDir, `${filename}.backup`)

  if (existsSync(filePath)) {
    try {
      renameSync(filePath, backupPath)
      console.log(`已备份: ${filename} -> ${filename}.backup`)
      return true
    } catch (error) {
      console.error(`备份文件失败 ${filename}:`, error.message)
      return false
    }
  }
  return false
}

/**
 * 执行数据迁移
 */
async function migrate() {
  console.log('开始数据迁移：JSON -> SQLite')
  console.log('='.repeat(50))

  try {
    // 初始化 Provider（会自动创建 schema）
    // 通过读取一次数据来触发 Provider 初始化
    await readApps()
    console.log('✓ Provider 已初始化')

    // 迁移应用数据
    console.log('\n迁移应用数据...')
    const apps = readJSONFile('apps.json')
    if (apps.length > 0) {
      await saveApps(apps)
      console.log(`✓ 已迁移 ${apps.length} 个应用`)
      backupJSONFile('apps.json')
    } else {
      console.log('  无应用数据需要迁移')
    }

    // 迁移问答记录
    console.log('\n迁移问答记录...')
    const queryRecords = readJSONFile('query-records.json')
    if (queryRecords.length > 0) {
      await saveQueryRecords(queryRecords)
      console.log(`✓ 已迁移 ${queryRecords.length} 条问答记录`)
      backupJSONFile('query-records.json')
    } else {
      console.log('  无问答记录需要迁移')
    }

    // 迁移反馈数据
    console.log('\n迁移反馈数据...')
    const feedbacks = readJSONFile('feedbacks.json')
    if (feedbacks.length > 0) {
      await saveFeedbacks(feedbacks)
      console.log(`✓ 已迁移 ${feedbacks.length} 条反馈`)
      backupJSONFile('feedbacks.json')
    } else {
      console.log('  无反馈数据需要迁移')
    }

    // 迁移数据集
    console.log('\n迁移数据集...')
    const datasets = readJSONFile('datasets.json')
    if (datasets.length > 0) {
      await saveDatasets(datasets)
      console.log(`✓ 已迁移 ${datasets.length} 个数据集`)
      backupJSONFile('datasets.json')
    } else {
      console.log('  无数据集需要迁移')
    }

    // 迁移命中分析
    console.log('\n迁移命中分析...')
    const hitAnalyses = readJSONFile('hit-analyses.json')
    if (hitAnalyses.length > 0) {
      await saveHitAnalyses(hitAnalyses)
      console.log(`✓ 已迁移 ${hitAnalyses.length} 条命中分析`)
      backupJSONFile('hit-analyses.json')
    } else {
      console.log('  无命中分析需要迁移')
    }

    // 迁移效果评估
    console.log('\n迁移效果评估...')
    const evaluations = readJSONFile('evaluations.json')
    if (evaluations.length > 0) {
      await saveEvaluations(evaluations)
      console.log(`✓ 已迁移 ${evaluations.length} 条效果评估`)
      backupJSONFile('evaluations.json')
    } else {
      console.log('  无效果评估需要迁移')
    }

    // 迁移优化建议
    console.log('\n迁移优化建议...')
    const suggestions = readJSONFile('optimization-suggestions.json')
    if (suggestions.length > 0) {
      await saveOptimizationSuggestions(suggestions)
      console.log(`✓ 已迁移 ${suggestions.length} 条优化建议`)
      backupJSONFile('optimization-suggestions.json')
    } else {
      console.log('  无优化建议需要迁移')
    }

    console.log('\n' + '='.repeat(50))
    console.log('✓ 数据迁移完成！')
    console.log('\n注意：原始 JSON 文件已备份为 .backup 文件')
    console.log('数据库文件位置: data/cirl.db')

  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    throw error
  } finally {
    await closeProvider()
  }
}

// 如果直接运行此脚本，执行迁移
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, '/'))

if (isMainModule || process.argv[1]?.includes('migrate.js')) {
  migrate().catch(error => {
    console.error('迁移失败:', error)
    process.exit(1)
  })
}

export { migrate }

