<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">问答（QA）跟踪</h2>
      <p class="text-sm text-muted-foreground">
        记录所有实时问答，支持筛选与一键加入 QA 管理
      </p>
    </div>

    <Card class="p-5 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <Select v-model="selectedAppId" @update:model-value="handleFilterChange">
          <SelectTrigger class="w-[200px]">
            <SelectValue placeholder="选择应用" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部应用</SelectItem>
            <SelectItem v-for="app in apps" :key="app.id" :value="app.id">
              {{ app.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          v-model="startDate"
          type="date"
          placeholder="开始日期"
          class="w-[150px]"
          @change="handleFilterChange"
        />
        <Input
          v-model="endDate"
          type="date"
          placeholder="结束日期"
          class="w-[150px]"
          @change="handleFilterChange"
        />
        <Input
          v-model="keyword"
          placeholder="输入关键字（输入/输出）"
          class="w-[220px]"
          @keyup.enter="handleFilterChange"
        />
        <Button size="sm" variant="secondary" @click="handleFilterChange">
          搜索
        </Button>
        <Button variant="outline" size="sm" @click="resetFilters">
          重置
        </Button>
        <Button
          size="sm"
          :disabled="exportLoading"
          @click="exportRecords"
        >
          {{ exportLoading ? '导出中...' : '导出 JSON' }}
        </Button>
      </div>

      <div v-if="loading" class="text-center py-6 text-muted-foreground">
        加载中...
      </div>
      <div v-else-if="records.length === 0" class="text-center py-6 text-muted-foreground">
        暂无问答记录
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="record in records"
          :key="record.id"
          class="p-3 border rounded-lg hover:bg-muted/40 space-y-3 text-sm"
        >
          <template v-if="record.ignored">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-muted-foreground">
                <Badge variant="outline">已忽略</Badge>
                <span>{{ getAppName(record.appId) }}</span>
              </div>
              <Button size="sm" variant="outline" @click="toggleIgnore(record, false)">恢复显示</Button>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ formatDate(record.updatedAt) }}
            </p>
          </template>
          <template v-else>
            <div class="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{{ getAppName(record.appId) }}</Badge>
              <Badge :variant="record.curated ? 'default' : 'outline'">
                {{ record.curated ? '已纳入 QA 管理' : '未纳入 QA' }}
              </Badge>
              <Badge :variant="record.metadata?.lastAnalyzedAt ? 'default' : 'outline'">
                {{ record.metadata?.lastAnalyzedAt ? '已分析' : '待分析' }}
              </Badge>
              <Badge v-if="record.metadata?.lastMatchType">
                最近命中：{{ matchTypeLabel(record.metadata.lastMatchType) }}
              </Badge>
            </div>

            <p>
              <span class="text-xs text-muted-foreground">输入：</span>
              {{ record.input }}
            </p>
            <p>
              <span class="text-xs text-muted-foreground">输出：</span>
              {{ record.output }}
            </p>

            <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>创建：{{ formatDate(record.createdAt) }}</span>
              <span v-if="record.metadata?.lastAnalyzedAt">
                最近分析：{{ formatDate(record.metadata.lastAnalyzedAt) }}
              </span>
              <span v-if="record.metadata?.lastSimilarity !== undefined">
                命中：{{ record.metadata.lastSimilarity }}%
              </span>
              <span v-if="record.metadata?.responseTime">
                响应：{{ record.metadata.responseTime }} ms
              </span>
              <span>命中统计：{{ getHitSummary(record.id) }}</span>
            </div>

            <div class="flex gap-2">
              <Button size="sm" @click="openFeedbackModal(record)">
                提交反馈
              </Button>
              <Button
                size="sm"
                variant="outline"
                :disabled="record.curated"
                @click="addToQAManagement(record)"
              >
                {{ record.curated ? '已加入 QA 管理' : '加入 QA 管理' }}
              </Button>
              <Button size="sm" variant="ghost" @click="toggleIgnore(record, true)">
                忽略
              </Button>
            </div>
          </template>
        </div>
      </div>

      <div class="flex items-center justify-between text-sm text-muted-foreground">
        <span>共 {{ totalRecords }} 条，当前第 {{ currentPage }} 页</span>
        <div class="flex gap-2">
          <Button size="sm" variant="outline" :disabled="currentPage === 1" @click="changePage(-1)">上一页</Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="currentPage >= totalPages"
            @click="changePage(1)"
          >
            下一页
          </Button>
        </div>
      </div>
    </Card>

    <!-- 反馈对话框 -->
    <Dialog :open="showFeedbackModal" @update:open="showFeedbackModal = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>提交反馈</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">反馈类型</label>
            <Select v-model="feedbackForm.type">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="positive">正面</SelectItem>
                <SelectItem value="negative">负面</SelectItem>
                <SelectItem value="neutral">中性</SelectItem>
                <SelectItem value="correction">纠正</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">评分 (1-5)</label>
            <Input v-model.number="feedbackForm.rating" type="number" min="1" max="5" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">反馈内容</label>
            <Textarea v-model="feedbackForm.content" placeholder="输入反馈内容" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showFeedbackModal = false">取消</Button>
          <Button @click="handleSubmitFeedback">提交</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchApps, fetchQueryRecords, fetchHitAnalyses, createFeedback, updateQueryRecord } from '@/lib/api'
import type { App, QueryRecord, HitAnalysis } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const apps = ref<App[]>([])
const records = ref<QueryRecord[]>([])
const hitAnalyses = ref<HitAnalysis[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 10
const totalRecords = ref(0)
const selectedAppId = ref('all')
const startDate = ref('')
const endDate = ref('')
const keyword = ref('')
const showFeedbackModal = ref(false)
const currentRecord = ref<QueryRecord | null>(null)
const feedbackForm = ref({ type: 'positive' as const, rating: 5, content: '' })
const exportLoading = ref(false)

const hitSummaryMap = computed(() => {
  const map: Record<string, { exact: number; high: number; medium: number; none: number }> = {}
  hitAnalyses.value.forEach(analysis => {
    if (!map[analysis.queryRecordId]) {
      map[analysis.queryRecordId] = { exact: 0, high: 0, medium: 0, none: 0 }
    }
    map[analysis.queryRecordId][analysis.matchType] += 1
  })
  return map
})

function getHitSummary(recordId: string) {
  const summary = hitSummaryMap.value[recordId]
  if (!summary) return '无分析'
  const total = summary.exact + summary.high + summary.medium + summary.none
  return `命中 ${summary.exact + summary.high + summary.medium}/${total}`
}

function matchTypeLabel(type?: string) {
  if (!type) return '未分析'
  const map: Record<string, string> = {
    exact: '完全命中',
    high: '80% 以上命中',
    medium: '60% 以上命中',
    none: '未命中'
  }
  return map[type] || type
}

function getAppName(appId: string) {
  const app = apps.value.find(a => a.id === appId)
  return app?.name || appId
}

async function loadApps() {
  try {
    apps.value = await fetchApps()
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

function buildQueryParams(pageOverride?: number, pageSizeOverride?: number) {
  const params: Record<string, any> = {
    page: pageOverride ?? currentPage.value,
    pageSize: pageSizeOverride ?? pageSize
  }
  if (selectedAppId.value !== 'all') params.appId = selectedAppId.value
  if (startDate.value) params.startDate = startDate.value
  if (endDate.value) params.endDate = endDate.value
  if (keyword.value.trim()) params.keyword = keyword.value.trim()
  return params
}

async function loadRecords() {
  loading.value = true
  try {
    const result = await fetchQueryRecords(buildQueryParams())
    records.value = result.data
    totalRecords.value = result.total
  } catch (error) {
    console.error('Failed to load records:', error)
  } finally {
    loading.value = false
  }
}

async function loadHitData() {
  try {
    const params: any = {}
    if (selectedAppId.value !== 'all') params.appId = selectedAppId.value
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    hitAnalyses.value = await fetchHitAnalyses(params)
  } catch (error) {
    console.error('Failed to load hit analyses:', error)
  }
}

function handleFilterChange() {
  currentPage.value = 1
  loadRecords()
  loadHitData()
}

function resetFilters() {
  selectedAppId.value = 'all'
  startDate.value = ''
  endDate.value = ''
  keyword.value = ''
  handleFilterChange()
}

function openFeedbackModal(record: QueryRecord) {
  currentRecord.value = record
  showFeedbackModal.value = true
}

async function handleSubmitFeedback() {
  if (!currentRecord.value) return
  try {
    await createFeedback({
      queryRecordId: currentRecord.value.id,
      ...feedbackForm.value
    })
    showFeedbackModal.value = false
    feedbackForm.value = { type: 'positive', rating: 5, content: '' }
    alert('反馈提交成功')
  } catch (error) {
    console.error('Failed to submit feedback:', error)
    alert('提交失败')
  }
}

async function addToQAManagement(record: QueryRecord) {
  try {
    await updateQueryRecord(record.id, { curated: true })
    record.curated = true
    alert('已加入 QA 管理')
  } catch (error) {
    console.error('Failed to update record:', error)
    alert('操作失败')
  }
}

async function toggleIgnore(record: QueryRecord, ignored: boolean) {
  try {
    await updateQueryRecord(record.id, { ignored })
    record.ignored = ignored
  } catch (error) {
    console.error('Failed to toggle ignore:', error)
    alert('操作失败')
  }
}

function changePage(delta: number) {
  const next = currentPage.value + delta
  if (next < 1 || next > totalPages.value) return
  currentPage.value = next
  loadRecords()
}

async function exportRecords() {
  exportLoading.value = true
  try {
    const pageSizeForExport = 200
    let page = 1
    const collected: QueryRecord[] = []
    while (true) {
      const result = await fetchQueryRecords(buildQueryParams(page, pageSizeForExport))
      collected.push(...result.data)
      if (collected.length >= result.total) break
      page += 1
      if (result.data.length === 0) break
    }
    const blob = new Blob([JSON.stringify(collected, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `qa-tracking-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export records:', error)
    alert('导出失败')
  } finally {
    exportLoading.value = false
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(totalRecords.value / pageSize)))

onMounted(() => {
  loadApps()
  handleFilterChange()
})
</script>

