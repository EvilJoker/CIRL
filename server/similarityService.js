// 相似度计算服务
// 初期使用简单的文本相似度算法，后续可接入 AI 服务

/**
 * 计算两个文本的相似度（0-100）
 * 使用简单的余弦相似度和编辑距离的加权平均
 */
export function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0
  if (text1 === text2) return 100

  // 余弦相似度
  const cosine = cosineSimilarity(text1, text2)

  // 编辑距离相似度
  const edit = editDistanceSimilarity(text1, text2)

  // 加权平均（余弦相似度权重更高）
  return Math.round((cosine * 0.6) + (edit * 0.4))
}

/**
 * 余弦相似度计算
 */
function cosineSimilarity(text1, text2) {
  const words1 = text1.toLowerCase().split(/\s+/)
  const words2 = text2.toLowerCase().split(/\s+/)

  const allWords = new Set([...words1, ...words2])
  const vector1 = Array.from(allWords).map(word => words1.filter(w => w === word).length)
  const vector2 = Array.from(allWords).map(word => words2.filter(w => w === word).length)

  const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0)
  const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0))
  const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0))

  if (magnitude1 === 0 || magnitude2 === 0) return 0
  return (dotProduct / (magnitude1 * magnitude2)) * 100
}

/**
 * 编辑距离相似度计算
 */
function editDistanceSimilarity(text1, text2) {
  const distance = levenshteinDistance(text1, text2)
  const maxLength = Math.max(text1.length, text2.length)
  if (maxLength === 0) return 100
  return ((maxLength - distance) / maxLength) * 100
}

/**
 * 计算编辑距离（Levenshtein Distance）
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length
  const n = str2.length
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // 删除
          dp[i][j - 1] + 1,     // 插入
          dp[i - 1][j - 1] + 1  // 替换
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * 根据相似度确定匹配类型
 */
export function getMatchType(similarity) {
  if (similarity >= 100) return 'exact'
  if (similarity >= 80) return 'high'
  if (similarity >= 60) return 'medium'
  return 'none'
}

