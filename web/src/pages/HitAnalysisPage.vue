<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">命中分析</h2>
      <p class="text-sm text-muted-foreground">分析问答记录与数据集的匹配情况</p>
    </div>

    <Card class="p-6 space-y-6">
      <div>
        <h3 class="font-semibold mb-2">增量问答分析</h3>
        <p class="text-sm text-muted-foreground mb-4">
          仅分析尚未被处理的问答记录，适合每日巡检
        </p>
        <div class="flex flex-wrap items-center gap-4">
          <Select v-model="incrementalForm.appId">
            <SelectTrigger class="w-[200px]">
              <SelectValue placeholder="选择应用" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="app in apps" :key="app.id" :value="app.id">
                {{ app.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="incrementalForm.datasetId">
            <SelectTrigger class="w-[200px]">
              <SelectValue placeholder="选择数据集" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="dataset in datasetsForApp" :key="dataset.id" :value="dataset.id">
                {{ dataset.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button @click="runIncremental" :disabled="runningIncremental">
            {{ runningIncremental ? '分析中...' : '增量问答分析' }}
          </Button>
        </div>
      </div>

      <Separator />

      <div>
        <h3 class="font-semibold mb-2">全量问答分析</h3>
        <p class="text-sm text-muted-foreground mb-4">
          选择时间范围对所有问答重新计算命中
        </p>
        <div class="flex flex-wrap items-center gap-4">
          <Select v-model="fullForm.appId">
            <SelectTrigger class="w-[200px]">
              <SelectValue placeholder="选择应用" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="app in apps" :key="app.id" :value="app.id">
                {{ app.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="fullForm.datasetId">
            <SelectTrigger class="w-[200px]">
              <SelectValue placeholder="选择数据集" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="dataset in datasetsForFull" :key="dataset.id" :value="dataset.id">
                {{ dataset.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-model="fullForm.startDate"
            type="date"
            placeholder="开始日期"
            class="w-[150px]"
          />
          <Input
            v-model="fullForm.endDate"
            type="date"
            placeholder="结束日期"
            class="w-[150px]"
          />
          <Button @click="runFull" :disabled="runningFull">
            {{ runningFull ? '分析中...' : '全量问答分析' }}
          </Button>
        </div>
      </div>

      <div v-if="stats" class="grid grid-cols-4 gap-4">
        <div class="p-4 border rounded-lg">
          <p class="text-sm text-muted-foreground">完全命中</p>
          <p class="text-2xl font-bold mt-1">{{ stats.exact }}</p>
        </div>
        <div class="p-4 border rounded-lg">
          <p class="text-sm text-muted-foreground">80%命中</p>
          <p class="text-2xl font-bold mt-1">{{ stats.high }}</p>
        </div>
        <div class="p-4 border rounded-lg">
          <p class="text-sm text-muted-foreground">60%命中</p>
          <p class="text-2xl font-bold mt-1">{{ stats.medium }}</p>
        </div>
        <div class="p-4 border rounded-lg">
          <p class="text-sm text-muted-foreground">未命中</p>
          <p class="text-2xl font-bold mt-1">{{ stats.none }}</p>
        </div>
      </div>
    </Card>

    <Card class="p-6 space-y-4">
      <h3 class="font-semibold">最近命中记录</h3>
      <div v-if="recentAnalyses.length === 0" class="text-sm text-muted-foreground">
        暂无分析记录，执行任务后可在此查看。
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="analysis in recentAnalyses"
          :key="analysis.id"
          class="p-3 border rounded flex flex-wrap justify-between gap-2 text-sm"
        >
          <div>
            <p class="font-medium">QA：{{ analysis.queryRecordId }}</p>
            <p class="text-xs text-muted-foreground">
              命中类型：{{ matchTypeLabel(analysis.matchType) }}（{{ analysis.similarity }}%）
            </p>
          </div>
          <span class="text-xs text-muted-foreground">
            {{ formatDate(analysis.createdAt) }}
          </span>
        </div>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fetchApps, fetchDatasets, runIncrementalAnalysis, runFullAnalysis, fetchHitAnalysisStats, fetchHitAnalyses } from '@/lib/api'
import type { App, Dataset, HitAnalysis } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/utils'

const apps = ref<App[]>([])
const datasets = ref<Dataset[]>([])
const hitAnalyses = ref<HitAnalysis[]>([])
const runningIncremental = ref(false)
const runningFull = ref(false)
const stats = ref<{ exact: number; high: number; medium: number; none: number; total: number } | null>(null)
const incrementalForm = ref({
  appId: '',
  datasetId: ''
})
const fullForm = ref({
  appId: '',
  datasetId: '',
  startDate: '',
  endDate: ''
})

async function loadApps() {
  try {
    apps.value = await fetchApps()
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

async function loadDatasets() {
  try {
    datasets.value = await fetchDatasets()
  } catch (error) {
    console.error('Failed to load datasets:', error)
  }
}

const datasetsForApp = computed(() => {
  if (!incrementalForm.value.appId) return datasets.value
  return datasets.value.filter(dataset => dataset.appId === incrementalForm.value.appId)
})

const datasetsForFull = computed(() => {
  if (!fullForm.value.appId) return datasets.value
  return datasets.value.filter(dataset => dataset.appId === fullForm.value.appId)
})

async function runIncremental() {
  if (!incrementalForm.value.appId || !incrementalForm.value.datasetId) {
    alert('请选择应用和数据集')
    return
  }
  runningIncremental.value = true
  try {
    await runIncrementalAnalysis(incrementalForm.value)
    await refreshStats({
      appId: incrementalForm.value.appId,
      datasetId: incrementalForm.value.datasetId
    })
    await loadHitAnalyses()
    alert('增量分析已完成')
  } catch (error) {
    console.error('Failed incremental analysis:', error)
    alert('分析失败')
  } finally {
    runningIncremental.value = false
  }
}

async function runFull() {
  if (!fullForm.value.appId || !fullForm.value.datasetId || !fullForm.value.startDate || !fullForm.value.endDate) {
    alert('请填写完整信息')
    return
  }
  runningFull.value = true
  try {
    await runFullAnalysis(fullForm.value)
    await refreshStats({
      appId: fullForm.value.appId,
      datasetId: fullForm.value.datasetId,
      startDate: fullForm.value.startDate,
      endDate: fullForm.value.endDate
    })
    await loadHitAnalyses()
    alert('全量分析已完成')
  } catch (error) {
    console.error('Failed full analysis:', error)
    alert('分析失败')
  } finally {
    runningFull.value = false
  }
}

async function refreshStats(params?: { appId: string; datasetId: string; startDate?: string; endDate?: string }) {
  if (!params) {
    stats.value = null
    return
  }
  try {
    const result = await fetchHitAnalysisStats(params)
    stats.value = result
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
}

async function loadHitAnalyses() {
  try {
    hitAnalyses.value = await fetchHitAnalyses()
  } catch (error) {
    console.error('Failed to load hit analyses:', error)
  }
}

const recentAnalyses = computed(() => {
  return [...hitAnalyses.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
})

function matchTypeLabel(type: HitAnalysis['matchType']) {
  const map: Record<HitAnalysis['matchType'], string> = {
    exact: '完全命中',
    high: '80% 命中',
    medium: '60% 命中',
    none: '未命中'
  }
  return map[type]
}

onMounted(async () => {
  await loadApps()
  await loadDatasets()
  await loadHitAnalyses()
})
</script>
