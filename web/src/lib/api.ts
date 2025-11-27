const API_BASE = '/api'
import type { App, QueryRecord, Feedback, Dataset, HitAnalysis, Evaluation, OptimizationSuggestion } from '@/types'

// ========== 应用（App）管理 ==========

export async function fetchApps(): Promise<App[]> {
  const res = await fetch(`${API_BASE}/apps`)
  if (!res.ok) throw new Error('Failed to fetch apps')
  const result = await res.json()
  return result.data || []
}

export async function fetchApp(id: string): Promise<App> {
  const res = await fetch(`${API_BASE}/apps/${id}`)
  if (!res.ok) throw new Error('Failed to fetch app')
  return res.json()
}

export async function createApp(data: { name: string; description?: string }): Promise<App> {
  const res = await fetch(`${API_BASE}/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create app')
  return res.json()
}

export async function updateApp(id: string, data: Partial<App>): Promise<App> {
  const res = await fetch(`${API_BASE}/apps/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to update app')
  return res.json()
}

export async function deleteApp(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/apps/${id}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to delete app')
}

// ========== 问答记录（QueryRecord）管理 ==========

export async function fetchQueryRecords(params?: {
  appId?: string
  startDate?: string
  endDate?: string
  curated?: boolean
  ignored?: boolean
  page?: number
  pageSize?: number
}): Promise<{ data: QueryRecord[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams()
  if (params?.appId) query.set('appId', params.appId)
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  if (params?.curated !== undefined) query.set('curated', String(params.curated))
  if (params?.ignored !== undefined) query.set('ignored', String(params.ignored))
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('pageSize', String(params.pageSize))
  const queryStr = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`${API_BASE}/query-records${queryStr}`)
  if (!res.ok) throw new Error('Failed to fetch query records')
  return res.json()
}

export async function fetchQueryRecord(id: string): Promise<QueryRecord> {
  const res = await fetch(`${API_BASE}/query-records/${id}`)
  if (!res.ok) throw new Error('Failed to fetch query record')
  return res.json()
}

export async function createQueryRecord(data: {
  appId: string
  input: string
  output: string
  modelId?: string
  context?: any
  metadata?: any
}): Promise<QueryRecord> {
  const res = await fetch(`${API_BASE}/query-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create query record')
  return res.json()
}

export async function updateQueryRecord(id: string, data: Partial<QueryRecord>): Promise<QueryRecord> {
  const res = await fetch(`${API_BASE}/query-records/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to update query record')
  return res.json()
}

// ========== 反馈（Feedback）管理 ==========

export async function fetchFeedbacks(params?: {
  status?: string
  appId?: string
  queryRecordId?: string
}): Promise<Feedback[]> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.appId) query.set('appId', params.appId)
  if (params?.queryRecordId) query.set('queryRecordId', params.queryRecordId)
  const queryStr = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`${API_BASE}/feedbacks${queryStr}`)
  if (!res.ok) throw new Error('Failed to fetch feedbacks')
  const result = await res.json()
  return result.data || []
}

export async function createFeedback(data: {
  queryRecordId: string
  type: 'positive' | 'negative' | 'neutral' | 'correction'
  content?: string
  rating?: number
  correction?: string
}): Promise<Feedback> {
  const res = await fetch(`${API_BASE}/feedbacks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create feedback')
  return res.json()
}

export async function updateFeedback(id: string, data: Partial<Feedback>): Promise<Feedback> {
  const res = await fetch(`${API_BASE}/feedbacks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to update feedback')
  return res.json()
}

export async function analyzeFeedback(id: string): Promise<{ feedback: Feedback; suggestion: OptimizationSuggestion }> {
  const res = await fetch(`${API_BASE}/feedbacks/${id}/analyze`, {
    method: 'POST'
  })
  if (!res.ok) throw new Error('Failed to analyze feedback')
  return res.json()
}

// ========== 数据集（Dataset）管理 ==========

export async function fetchDatasets(appId?: string): Promise<Dataset[]> {
  const query = appId ? `?appId=${appId}` : ''
  const res = await fetch(`${API_BASE}/datasets${query}`)
  if (!res.ok) throw new Error('Failed to fetch datasets')
  const result = await res.json()
  return result.data || []
}

export async function fetchDataset(id: string): Promise<Dataset> {
  const res = await fetch(`${API_BASE}/datasets/${id}`)
  if (!res.ok) throw new Error('Failed to fetch dataset')
  return res.json()
}

export async function createDataset(data: {
  appId: string
  name: string
  description?: string
  queryRecordIds: string[]
}): Promise<Dataset> {
  const res = await fetch(`${API_BASE}/datasets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create dataset')
  return res.json()
}

export async function updateDataset(id: string, data: Partial<Dataset>): Promise<Dataset> {
  const res = await fetch(`${API_BASE}/datasets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to update dataset')
  return res.json()
}

export async function deleteDataset(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/datasets/${id}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to delete dataset')
}

export async function addRecordToDataset(datasetId: string, recordId: string): Promise<Dataset> {
  const res = await fetch(`${API_BASE}/datasets/${datasetId}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recordId })
  })
  if (!res.ok) throw new Error('Failed to add record to dataset')
  return res.json()
}

export async function removeRecordFromDataset(datasetId: string, recordId: string): Promise<Dataset> {
  const res = await fetch(`${API_BASE}/datasets/${datasetId}/records/${recordId}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to remove record from dataset')
  return res.json()
}

// ========== 命中分析（HitAnalysis）API ==========

export async function createHitAnalysis(data: {
  appId: string
  datasetId: string
  startDate: string
  endDate: string
}): Promise<{ count: number; analyses: HitAnalysis[] }> {
  const res = await fetch(`${API_BASE}/hit-analyses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create hit analysis')
  return res.json()
}

export async function runFullAnalysis(data: {
  appId: string
  datasetId: string
  startDate: string
  endDate: string
}) {
  const res = await fetch(`${API_BASE}/hit-analyses/full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to perform full analysis')
  return res.json()
}

export async function runIncrementalAnalysis(data: {
  appId: string
  datasetId: string
}) {
  const res = await fetch(`${API_BASE}/hit-analyses/incremental`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to perform incremental analysis')
  return res.json()
}

export async function fetchHitAnalyses(params?: {
  appId?: string
  datasetId?: string
  startDate?: string
  endDate?: string
}): Promise<HitAnalysis[]> {
  const query = new URLSearchParams()
  if (params?.appId) query.set('appId', params.appId)
  if (params?.datasetId) query.set('datasetId', params.datasetId)
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  const queryStr = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`${API_BASE}/hit-analyses${queryStr}`)
  if (!res.ok) throw new Error('Failed to fetch hit analyses')
  const result = await res.json()
  return result.data || []
}

export async function fetchHitAnalysisStats(params: {
  appId?: string
  datasetId?: string
  startDate?: string
  endDate?: string
}): Promise<{ exact: number; high: number; medium: number; none: number; total: number }> {
  const query = new URLSearchParams()
  if (params.appId) query.set('appId', params.appId)
  if (params.datasetId) query.set('datasetId', params.datasetId)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  const queryStr = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`${API_BASE}/hit-analyses/stats${queryStr}`)
  if (!res.ok) throw new Error('Failed to fetch hit analysis stats')
  return res.json()
}

// ========== 效果评估（Evaluation）API ==========

export async function createEvaluation(data: {
  appId: string
  datasetId: string
  evaluationType: 'before' | 'after'
  startDate: string
  endDate: string
}): Promise<Evaluation> {
  const res = await fetch(`${API_BASE}/evaluations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to create evaluation')
  return res.json()
}

export async function fetchEvaluations(params?: {
  appId?: string
  datasetId?: string
  evaluationType?: 'before' | 'after'
}): Promise<Evaluation[]> {
  const query = new URLSearchParams()
  if (params?.appId) query.set('appId', params.appId)
  if (params?.datasetId) query.set('datasetId', params.datasetId)
  if (params?.evaluationType) query.set('evaluationType', params.evaluationType)
  const queryStr = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`${API_BASE}/evaluations${queryStr}`)
  if (!res.ok) throw new Error('Failed to fetch evaluations')
  const result = await res.json()
  return result.data || []
}

export async function compareEvaluations(params: {
  appId: string
  datasetId: string
}): Promise<{ before?: Evaluation; after?: Evaluation }> {
  const query = new URLSearchParams()
  query.set('appId', params.appId)
  query.set('datasetId', params.datasetId)
  const res = await fetch(`${API_BASE}/evaluations/compare?${query}`)
  if (!res.ok) throw new Error('Failed to compare evaluations')
  return res.json()
}

// ========== 优化建议（OptimizationSuggestion）API ==========

export async function fetchOptimizationSuggestions(params?: {
  appId?: string
  status?: string
}): Promise<OptimizationSuggestion[]> {
  const query = new URLSearchParams()
  if (params?.appId) query.set('appId', params.appId)
  if (params?.status) query.set('status', params.status)
  const queryStr = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`${API_BASE}/optimization-suggestions${queryStr}`)
  if (!res.ok) throw new Error('Failed to fetch optimization suggestions')
  const result = await res.json()
  return result.data || []
}

export async function updateOptimizationSuggestion(id: string, data: Partial<OptimizationSuggestion>): Promise<OptimizationSuggestion> {
  const res = await fetch(`${API_BASE}/optimization-suggestions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to update optimization suggestion')
  return res.json()
}

// ========== 统计（Stats）API ==========

export interface TimelinePoint {
  timestamp: string
  value: number
}

export interface RequestStats {
  appId: string
  count24h: number
  count7d: number
  count30d: number
  timeline24h: TimelinePoint[]
  timeline7d: TimelinePoint[]
  timeline30d: TimelinePoint[]
}

export async function fetchRequestStats(appIds?: string[]): Promise<Record<string, RequestStats>> {
  const query = new URLSearchParams()
  if (appIds && appIds.length > 0) {
    query.set('appIds', appIds.join(','))
  }
  const queryStr = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`${API_BASE}/stats/requests${queryStr}`)
  if (!res.ok) throw new Error('Failed to fetch request stats')
  const result = await res.json()
  return result.data || {}
}
