/**
 * 写缓冲管理器
 * 用于批量写入操作，减少数据库 I/O
 */

export class WriteBuffer {
  constructor(options = {}) {
    // 缓冲区大小阈值（达到此数量时触发写入）
    this.batchSize = options.batchSize || 100

    // 定时器间隔（毫秒，达到此时间时触发写入）
    this.flushInterval = options.flushInterval || 5000 // 5秒

    // 缓冲区
    this.buffer = []

    // 定时器
    this.timer = null

    // 是否正在刷新
    this.flushing = false

    // 写入回调函数
    this.writeCallback = null

    // 错误处理回调
    this.errorCallback = options.errorCallback || null
  }

  /**
   * 设置写入回调函数
   */
  setWriteCallback(callback) {
    this.writeCallback = callback
  }

  /**
   * 添加数据到缓冲区
   */
  async add(data) {
    if (!this.writeCallback) {
      throw new Error('Write callback not set. Call setWriteCallback() first.')
    }

    this.buffer.push(data)

    // 如果达到批次大小，立即刷新
    if (this.buffer.length >= this.batchSize) {
      await this.flush()
    } else {
      // 否则启动定时器（如果还没启动）
      this.startTimer()
    }
  }

  /**
   * 启动定时器
   */
  startTimer() {
    if (this.timer) {
      return // 定时器已启动
    }

    this.timer = setTimeout(async () => {
      this.timer = null
      await this.flush()
    }, this.flushInterval)
  }

  /**
   * 刷新缓冲区（写入所有待处理数据）
   */
  async flush() {
    if (this.flushing || this.buffer.length === 0) {
      return
    }

    // 清除定时器
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    this.flushing = true

    // 复制缓冲区并清空
    const dataToWrite = [...this.buffer]
    this.buffer = []

    try {
      // 执行写入
      if (this.writeCallback && dataToWrite.length > 0) {
        await this.writeCallback(dataToWrite)
      }
    } catch (error) {
      console.error('写缓冲刷新失败:', error)

      // 将数据重新放回缓冲区（避免丢失）
      this.buffer.unshift(...dataToWrite)

      // 调用错误处理回调
      if (this.errorCallback) {
        this.errorCallback(error, dataToWrite)
      } else {
        throw error
      }
    } finally {
      this.flushing = false
    }
  }

  /**
   * 获取当前缓冲区大小
   */
  getSize() {
    return this.buffer.length
  }

  /**
   * 检查是否为空
   */
  isEmpty() {
    return this.buffer.length === 0
  }

  /**
   * 清空缓冲区（不写入）
   */
  clear() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.buffer = []
  }

  /**
   * 关闭写缓冲（刷新所有待处理数据）
   */
  async close() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.flush()
  }
}

