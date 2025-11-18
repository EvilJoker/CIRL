<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">问答（QA）管理</h2>
      <p class="text-sm text-muted-foreground">
        管理已筛选的 QA，编辑答案并维护数据集归属
      </p>
    </div>

    <Card class="p-5 space-y-5">
      <div class="flex flex-wrap gap-3">
        <Select v-model="timeRange">
          <SelectTrigger class="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部时间</SelectItem>
            <SelectItem value="1d">最近 24 小时</SelectItem>
            <SelectItem value="7d">最近 7 天</SelectItem>
            <SelectItem value="30d">最近 30 天</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="datasetFilter">
          <SelectTrigger class="w-[200px]">
            <SelectValue placeholder="选择数据集" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部数据集</SelectItem>
            <SelectItem value="unassigned">未归属</SelectItem>
            <SelectItem v-for="dataset in datasets" :key="dataset.id" :value="dataset.id">
              {{ dataset.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="hitFilter">
          <SelectTrigger class="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部命中</SelectItem>
            <SelectItem value="60">60% 以上命中</SelectItem>
            <SelectItem value="80">80% 以上命中</SelectItem>
            <SelectItem value="exact">完全命中</SelectItem>
            <SelectItem value="none">未命中</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="sortOrder">
          <SelectTrigger class="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">命中次数（高→低）</SelectItem>
            <SelectItem value="asc">命中次数（低→高）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <span class="text-muted-foreground">Tag 筛选（{{ tagFilterLogic === 'and' ? '且' : '或' }}）</span>
          <Button size="sm" variant="outline" @click="toggleTagLogic">
            切换为 {{ tagFilterLogic === 'and' ? '或' : '且' }} 条件
          </Button>
          <Input
            v-model="tagSearch"
            placeholder="搜索 Tag"
            class="w-[200px]"
          />
        </div>
        <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto text-sm">
          <label
            v-for="tag in tagOptions"
            :key="tag"
            class="inline-flex items-center gap-1 border rounded-full px-3 py-1 text-xs"
          >
            <input
              type="checkbox"
              :value="tag"
              :checked="selectedTags.includes(tag)"
              @change="toggleSelectedTag(tag)"
            />
            #{{ tag }}
          </label>
          <span v-if="tagOptions.length === 0" class="text-xs text-muted-foreground">暂无标签</span>
        </div>
      </div>

      <div v-if="loading" class="text-center py-6 text-muted-foreground">
        加载中...
      </div>
      <div v-else-if="filteredRecords.length === 0" class="text-center py-6 text-muted-foreground">
        暂无 QA
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="record in paginatedRecords"
          :key="record.id"
          class="p-4 border rounded-lg space-y-3 text-sm"
        >
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <Badge>{{ getAppName(record.appId) }}</Badge>
              <Badge variant="secondary">命中：{{ getHitSummary(record.id) }}</Badge>
              <Badge variant="secondary">
                最近分析：{{ record.metadata?.lastAnalyzedAt ? formatDate(record.metadata.lastAnalyzedAt) : '—' }}
              </Badge>
            </div>
            <Button size="sm" variant="outline" @click="saveRecord(record)">
              保存修改
            </Button>
          </div>

          <div>
            <label class="text-sm font-medium text-muted-foreground">输入</label>
            <Textarea v-model="editCache[record.id].input" rows="2" />
          </div>
          <div>
            <label class="text-sm font-medium text-muted-foreground">输出</label>
            <Textarea v-model="editCache[record.id].output" rows="3" />
          </div>

          <div class="space-y-2">
            <p class="text-sm font-medium text-muted-foreground">Tags</p>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="tag in record.tags || []" :key="tag" variant="outline">
                #{{ tag }}
              </Badge>
              <span v-if="!record.tags || record.tags.length === 0" class="text-xs text-muted-foreground">暂无标签</span>
            </div>
            <div class="flex gap-2">
              <Input
                v-model="tagInputCache[record.id]"
                placeholder="输入标签，逗号分隔"
              />
              <Button size="sm" variant="secondary" @click="saveTags(record)">更新</Button>
            </div>
          </div>

          <div>
            <p class="text-sm font-medium text-muted-foreground mb-2">数据集归属</p>
            <div class="flex flex-wrap gap-3">
              <label
                v-for="dataset in datasets"
                :key="dataset.id"
                class="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  :checked="isRecordInDataset(record.id, dataset.id)"
                  @change="handleDatasetToggle(record.id, dataset.id, $event)"
                />
                {{ dataset.name }}
              </label>
              <span v-if="datasets.length === 0" class="text-xs text-muted-foreground">暂无数据集</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {{ filteredRecords.length }} 条，当前第 {{ currentPage }} 页</span>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" :disabled="currentPage === 1" @click="changePage(-1)">
              上一页
            </Button>
            <Button size="sm" variant="outline" :disabled="currentPage >= totalPages" @click="changePage(1)">
              下一页
            </Button>
          </div>
        </div>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { fetchApps, fetchQueryRecords, fetchDatasets, fetchHitAnalyses, updateQueryRecord, addRecordToDataset, removeRecordFromDataset } from '@/lib/api'
import type { App, QueryRecord, Dataset, HitAnalysis } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const apps = ref<App[]>([])
const datasets = ref<Dataset[]>([])
const records = ref<QueryRecord[]>([])
const hitAnalyses = ref<HitAnalysis[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 6

const timeRange = ref<'all' | '1d' | '7d' | '30d'>('all')
const datasetFilter = ref('all')
const hitFilter = ref('all')
const sortOrder = ref<'asc' | 'desc'>('desc')

const editCache = ref<Record<string, { input: string; output: string }>>({})
const tagInputCache = ref<Record<string, string>>({})
const selectedTags = ref<string[]>([])
const tagFilterLogic = ref<'and' | 'or'>('or')
const tagSearch = ref('')

const curatedRecords = computed(() => records.value.filter(r => r.curated))

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

const datasetMembership = computed(() => {
  const map: Record<string, Set<string>> = {}
  datasets.value.forEach(dataset => {
    dataset.queryRecordIds.forEach(id => {
      if (!map[id]) map[id] = new Set()
      map[id].add(dataset.id)
    })
  })
  return map
})

const filteredRecords = computed(() => {
  let result = curatedRecords.value.slice()
  const now = Date.now()
  if (timeRange.value !== 'all') {
    const thresholdMap = {
      '1d': 1,
      '7d': 7,
      '30d': 30
    }
    const days = thresholdMap[timeRange.value]
    const ms = days * 24 * 60 * 60 * 1000
    result = result.filter(r => now - new Date(r.updatedAt).getTime() <= ms)
  }
  if (datasetFilter.value === 'unassigned') {
    result = result.filter(r => !datasetMembership.value[r.id] || datasetMembership.value[r.id].size === 0)
  } else if (datasetFilter.value !== 'all') {
    result = result.filter(r => datasetMembership.value[r.id]?.has(datasetFilter.value))
  }
  if (hitFilter.value !== 'all') {
    result = result.filter(r => {
      const summary = hitSummaryMap.value[r.id]
      if (!summary) return hitFilter.value === 'none'
      const totalHits = summary.exact + summary.high + summary.medium
      if (hitFilter.value === 'none') return totalHits === 0
      if (hitFilter.value === 'exact') return summary.exact > 0
      if (hitFilter.value === '80') return summary.exact + summary.high > 0
      if (hitFilter.value === '60') return totalHits > 0
      return true
    })
  }
  if (selectedTags.value.length > 0) {
    result = result.filter(record => {
      const tags = record.tags || []
      if (tagFilterLogic.value === 'and') {
        return selectedTags.value.every(tag => tags.includes(tag))
      }
      return selectedTags.value.some(tag => tags.includes(tag))
    })
  }

  result.sort((a, b) => {
    const aHits = getTotalHits(a.id)
    const bHits = getTotalHits(b.id)
    return sortOrder.value === 'desc' ? bHits - aHits : aHits - bHits
  })
  return result
})

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredRecords.value.slice(start, start + pageSize)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / pageSize)))

const tagOptions = computed(() => {
  const set = new Set<string>()
  curatedRecords.value.forEach(record => record.tags?.forEach(tag => set.add(tag)))
  let options = Array.from(set).sort()
  if (tagSearch.value) {
    const keyword = tagSearch.value.toLowerCase()
    options = options.filter(tag => tag.toLowerCase().includes(keyword))
  }
  return options
})

function getAppName(appId: string) {
  return apps.value.find(a => a.id === appId)?.name || appId
}

function getTotalHits(recordId: string) {
  const summary = hitSummaryMap.value[recordId]
  if (!summary) return 0
  return summary.exact + summary.high + summary.medium
}

function getHitSummary(recordId: string) {
  const summary = hitSummaryMap.value[recordId]
  if (!summary) return '无分析'
  return `exact:${summary.exact} / high:${summary.high} / mid:${summary.medium} / none:${summary.none}`
}

function isRecordInDataset(recordId: string, datasetId: string) {
  return datasetMembership.value[recordId]?.has(datasetId) ?? false
}

async function toggleDataset(recordId: string, datasetId: string, checked: boolean) {
  try {
    if (checked) {
      await addRecordToDataset(datasetId, recordId)
    } else {
      await removeRecordFromDataset(datasetId, recordId)
    }
    await loadDatasets()
  } catch (error) {
    console.error('Failed to toggle dataset assignment:', error)
    alert('操作失败')
  }
}

function handleDatasetToggle(recordId: string, datasetId: string, event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  toggleDataset(recordId, datasetId, target.checked)
}

async function saveRecord(record: QueryRecord) {
  const payload = editCache.value[record.id]
  if (!payload) return
  try {
    await updateQueryRecord(record.id, {
      input: payload.input,
      output: payload.output,
      tags: parseTagInput(tagInputCache.value[record.id])
    })
    record.input = payload.input
    record.output = payload.output
    record.tags = parseTagInput(tagInputCache.value[record.id])
    alert('已保存')
  } catch (error) {
    console.error('Failed to save record:', error)
    alert('保存失败')
  }
}

async function saveTags(record: QueryRecord) {
  try {
    const tags = parseTagInput(tagInputCache.value[record.id])
    await updateQueryRecord(record.id, { tags })
    record.tags = tags
    alert('标签已更新')
  } catch (error) {
    console.error('Failed to save tags:', error)
    alert('更新失败')
  }
}

function parseTagInput(value?: string) {
  if (!value) return []
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

function toggleSelectedTag(tag: string) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter(t => t !== tag)
  } else {
    selectedTags.value = [...selectedTags.value, tag]
  }
  currentPage.value = 1
}

function toggleTagLogic() {
  tagFilterLogic.value = tagFilterLogic.value === 'and' ? 'or' : 'and'
  currentPage.value = 1
}

function changePage(delta: number) {
  const target = currentPage.value + delta
  if (target < 1 || target > totalPages.value) return
  currentPage.value = target
}

async function loadApps() {
  try {
    apps.value = await fetchApps()
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

async function loadRecords() {
  loading.value = true
  try {
    const result = await fetchQueryRecords({ curated: true, pageSize: 200 })
    records.value = result.data
  } catch (error) {
    console.error('Failed to load records:', error)
  } finally {
    loading.value = false
  }
}

async function loadDatasets() {
  try {
    datasets.value = await fetchDatasets()
  } catch (error) {
    console.error('Failed to load datasets:', error)
  }
}

async function loadHitAnalysesData() {
  try {
    hitAnalyses.value = await fetchHitAnalyses()
  } catch (error) {
    console.error('Failed to load hit analyses:', error)
  }
}

watch(
  () => curatedRecords.value,
  curated => {
    curated.forEach(record => {
      if (!editCache.value[record.id]) {
        editCache.value[record.id] = { input: record.input, output: record.output }
      }
      if (tagInputCache.value[record.id] === undefined) {
        tagInputCache.value[record.id] = (record.tags || []).join(', ')
      }
    })
  },
  { immediate: true, deep: true }
)

watch([timeRange, datasetFilter, hitFilter, sortOrder, selectedTags, tagFilterLogic], () => {
  currentPage.value = 1
})

onMounted(async () => {
  await Promise.all([loadApps(), loadRecords(), loadDatasets(), loadHitAnalysesData()])
})
</script>

