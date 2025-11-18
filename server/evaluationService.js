// 效果评估服务

/**
 * 计算评估指标
 */
export function calculateEvaluationMetrics(queryRecords, hitAnalyses, feedbacks) {
  const total = queryRecords.length
  if (total === 0) {
    return {
      accuracy: 0,
      speed: 0,
      exactHitRate: 0,
      highHitRate: 0,
      mediumHitRate: 0,
      noHitRate: 0,
      avgRating: 0,
      feedbackCount: 0
    }
  }

  // 命中率统计
  const hitStats = {
    exact: 0,
    high: 0,
    medium: 0,
    none: 0
  }

  hitAnalyses.forEach(analysis => {
    if (analysis.matchType === 'exact') hitStats.exact++
    else if (analysis.matchType === 'high') hitStats.high++
    else if (analysis.matchType === 'medium') hitStats.medium++
    else hitStats.none++
  })

  const exactHitRate = hitStats.exact / total
  const highHitRate = hitStats.high / total
  const mediumHitRate = hitStats.medium / total
  const noHitRate = hitStats.none / total

  // 准确性得分（综合命中率）
  const accuracy = (exactHitRate * 0.5) + (highHitRate * 0.3) + (mediumHitRate * 0.2) - (noHitRate * 0.3)
  const normalizedAccuracy = Math.max(0, Math.min(1, accuracy)) * 100

  // 速度（平均响应时间，如果有 metadata.responseTime）
  let totalSpeed = 0
  let speedCount = 0
  queryRecords.forEach(record => {
    if (record.metadata?.responseTime) {
      totalSpeed += record.metadata.responseTime
      speedCount++
    }
  })
  const speed = speedCount > 0 ? totalSpeed / speedCount : 0

  // 平均评分
  const ratings = feedbacks
    .filter(f => f.rating !== undefined)
    .map(f => f.rating)
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
    : 0

  return {
    accuracy: Math.round(normalizedAccuracy * 100) / 100,
    speed: Math.round(speed * 100) / 100,
    exactHitRate: Math.round(exactHitRate * 10000) / 100,
    highHitRate: Math.round(highHitRate * 10000) / 100,
    mediumHitRate: Math.round(mediumHitRate * 10000) / 100,
    noHitRate: Math.round(noHitRate * 10000) / 100,
    avgRating: Math.round(avgRating * 100) / 100,
    feedbackCount: feedbacks.length
  }
}

