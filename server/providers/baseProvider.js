/**
 * 数据 Provider 抽象基类
 * 定义所有数据操作的标准接口
 */
export class BaseProvider {
  // ========== 应用（App）管理 ==========
  async readApps() {
    throw new Error('readApps() must be implemented')
  }

  async saveApps(apps) {
    throw new Error('saveApps() must be implemented')
  }

  // ========== 问答记录（QueryRecord）管理 ==========
  async readQueryRecords() {
    throw new Error('readQueryRecords() must be implemented')
  }

  async saveQueryRecords(queryRecords) {
    throw new Error('saveQueryRecords() must be implemented')
  }

  // ========== 反馈（Feedback）管理 ==========
  async readFeedbacks() {
    throw new Error('readFeedbacks() must be implemented')
  }

  async saveFeedbacks(feedbacks) {
    throw new Error('saveFeedbacks() must be implemented')
  }

  // ========== 数据集（Dataset）管理 ==========
  async readDatasets() {
    throw new Error('readDatasets() must be implemented')
  }

  async saveDatasets(datasets) {
    throw new Error('saveDatasets() must be implemented')
  }

  // ========== 命中分析（HitAnalysis）管理 ==========
  async readHitAnalyses() {
    throw new Error('readHitAnalyses() must be implemented')
  }

  async saveHitAnalyses(hitAnalyses) {
    throw new Error('saveHitAnalyses() must be implemented')
  }

  // ========== 效果评估（Evaluation）管理 ==========
  async readEvaluations() {
    throw new Error('readEvaluations() must be implemented')
  }

  async saveEvaluations(evaluations) {
    throw new Error('saveEvaluations() must be implemented')
  }

  // ========== 优化建议（OptimizationSuggestion）管理 ==========
  async readOptimizationSuggestions() {
    throw new Error('readOptimizationSuggestions() must be implemented')
  }

  async saveOptimizationSuggestions(suggestions) {
    throw new Error('saveOptimizationSuggestions() must be implemented')
  }

  // ========== 统计（Stats）==========
  /**
   * 获取请求统计信息
   * @param {string[]} appIds - 应用ID列表，为空则统计所有应用
   * @returns {Promise<Object>} 统计信息，包含24小时、7天、30天的请求次数
   */
  async getRequestStats(appIds = []) {
    throw new Error('getRequestStats() must be implemented')
  }

  /**
   * 初始化 Provider（如果需要）
   */
  async initialize() {
    // 默认不需要初始化
  }

  /**
   * 关闭 Provider（如果需要）
   */
  async close() {
    // 默认不需要关闭
  }
}

