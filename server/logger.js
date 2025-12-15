import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 日志文件路径
const LOG_DIR = process.env.LOG_DIR || join(__dirname, '..', 'data')
const LOG_FILE = join(LOG_DIR, 'cirl.log')

// 确保日志目录存在
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true })
}

// 创建日志文件写入流
const logStream = createWriteStream(LOG_FILE, { flags: 'a' })

// 日志级别
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

// 当前日志级别（可通过环境变量配置）
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO

/**
 * 格式化时间戳
 */
function formatTimestamp() {
  const now = new Date()
  return now.toISOString().replace('T', ' ').substring(0, 23)
}

/**
 * 格式化日志消息
 */
function formatMessage(level, message, ...args) {
  const timestamp = formatTimestamp()
  const levelStr = level.padEnd(5)
  const argsStr = args.length > 0 ? ' ' + args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ') : ''
  return `[${timestamp}] ${levelStr} ${message}${argsStr}\n`
}

/**
 * 写入日志
 */
function writeLog(level, levelNum, message, ...args) {
  if (levelNum < CURRENT_LEVEL) {
    return
  }

  const logMessage = formatMessage(level, message, ...args)

  // 同时输出到控制台和文件
  if (levelNum >= LOG_LEVELS.ERROR) {
    console.error(logMessage.trim())
  } else if (levelNum >= LOG_LEVELS.WARN) {
    console.warn(logMessage.trim())
  } else {
    console.log(logMessage.trim())
  }

  // 写入文件（异步，不阻塞）
  logStream.write(logMessage, (err) => {
    if (err) {
      console.error('Failed to write log:', err)
    }
  })
}

/**
 * 日志记录器
 */
export const logger = {
  /**
   * 调试日志
   */
  debug(message, ...args) {
    writeLog('DEBUG', LOG_LEVELS.DEBUG, message, ...args)
  },

  /**
   * 信息日志
   */
  info(message, ...args) {
    writeLog('INFO', LOG_LEVELS.INFO, message, ...args)
  },

  /**
   * 警告日志
   */
  warn(message, ...args) {
    writeLog('WARN', LOG_LEVELS.WARN, message, ...args)
  },

  /**
   * 错误日志
   */
  error(message, ...args) {
    writeLog('ERROR', LOG_LEVELS.ERROR, message, ...args)
  },

  /**
   * 记录 HTTP 请求
   */
  request(method, path, statusCode, duration) {
    this.info(`HTTP ${method} ${path} ${statusCode} ${duration}ms`)
  },

  /**
   * 记录 API 错误
   */
  apiError(method, path, error) {
    this.error(`API Error ${method} ${path}:`, error.message || error)
  }
}

// 优雅关闭：确保日志流正确关闭
export function closeLogger() {
  return new Promise((resolve) => {
    logStream.end(() => {
      resolve()
    })
  })
}

