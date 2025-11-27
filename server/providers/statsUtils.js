const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const alignToHour = (date) => {
  const aligned = new Date(date.getTime())
  aligned.setUTCMinutes(0, 0, 0)
  return aligned
}

const alignToDay = (date) => {
  const aligned = new Date(date.getTime())
  aligned.setUTCHours(0, 0, 0, 0)
  return aligned
}

const BASE_TIMELINE_CONFIGS = [
  {
    id: '24h',
    countKey: 'count24h',
    timelineKey: 'timeline24h',
    durationMs: 24 * HOUR_MS,
    bucketCount: 24,
    intervalMs: HOUR_MS,
    alignFn: alignToHour,
    strftimeFormat: "%Y-%m-%dT%H:00:00.000Z"
  },
  {
    id: '7d',
    countKey: 'count7d',
    timelineKey: 'timeline7d',
    durationMs: 7 * DAY_MS,
    bucketCount: 7,
    intervalMs: DAY_MS,
    alignFn: alignToDay,
    strftimeFormat: "%Y-%m-%dT00:00:00.000Z"
  },
  {
    id: '30d',
    countKey: 'count30d',
    timelineKey: 'timeline30d',
    durationMs: 30 * DAY_MS,
    bucketCount: 30,
    intervalMs: DAY_MS,
    alignFn: alignToDay,
    strftimeFormat: "%Y-%m-%dT00:00:00.000Z"
  }
]

const generateBuckets = (config, now) => {
  const buckets = []
  const end = config.alignFn(new Date(now.getTime()))
  for (let i = config.bucketCount - 1; i >= 0; i--) {
    const bucket = new Date(end.getTime() - i * config.intervalMs)
    buckets.push(bucket.toISOString())
  }
  return buckets
}

export function getTimelineConfigs(now = new Date()) {
  return BASE_TIMELINE_CONFIGS.map(config => {
    const since = new Date(now.getTime() - config.durationMs)
    return {
      ...config,
      since,
      sinceIso: since.toISOString(),
      buckets: generateBuckets(config, now)
    }
  })
}

export function ensureStatsEntry(result, appId) {
  if (!result[appId]) {
    result[appId] = {
      appId,
      count24h: 0,
      count7d: 0,
      count30d: 0,
      timeline24h: [],
      timeline7d: [],
      timeline30d: []
    }
  }
  return result[appId]
}

export function assignTimelineFromMap(result, appIds, timelineKey, buckets, valueMap) {
  const mapAppIds = Array.from(valueMap.keys())
  const targetAppIds =
    appIds.length > 0
      ? appIds
      : Array.from(new Set([...Object.keys(result), ...mapAppIds]))

  for (const appId of targetAppIds) {
    const entry = ensureStatsEntry(result, appId)
    const bucketMap = valueMap.get(appId)
    entry[timelineKey] = buckets.map(bucket => ({
      timestamp: bucket,
      value: bucketMap?.get(bucket) || 0
    }))
  }
}

export function upsertValue(valueMap, appId, bucket, value) {
  if (!valueMap.has(appId)) {
    valueMap.set(appId, new Map())
  }
  valueMap.get(appId).set(bucket, value)
}

export function incrementBucket(valueMap, appId, bucket, delta = 1) {
  if (!valueMap.has(appId)) {
    valueMap.set(appId, new Map())
  }
  const bucketMap = valueMap.get(appId)
  bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + delta)
}

export { alignToHour, alignToDay }

