import { JsonProvider } from './jsonProvider.js'
import { SqliteProvider } from './sqliteProvider.js'
import { logger } from '../logger.js'

/**
 * Provider 管理器
 * 根据配置选择使用 JSON 或 SQLite Provider
 */

// Provider 实例
let providerInstance = null
let providerType = null

/**
 * 获取当前 Provider
 */
export async function getProvider(type = null) {
  // 如果已初始化且类型匹配，直接返回
  if (providerInstance && (!type || providerType === type)) {
    return providerInstance
  }

  // 确定使用的 Provider 类型
  // 优先使用传入的 type，其次使用环境变量 DATA_PROVIDER
  // 如果都没有，使用默认值 sqlite（本地开发时的后备方案）
  if (!type) {
    type = process.env.DATA_PROVIDER || 'sqlite'
  }

  // 创建 Provider 实例
  if (type === 'sqlite') {
    providerInstance = new SqliteProvider()
    await providerInstance.initialize()
  } else {
    providerInstance = new JsonProvider()
  }

  providerType = type
  logger.info(`使用数据 Provider: ${type}`)

  return providerInstance
}

/**
 * 关闭当前 Provider
 */
export async function closeProvider() {
  if (providerInstance) {
    await providerInstance.close()
    providerInstance = null
    providerType = null
  }
}

