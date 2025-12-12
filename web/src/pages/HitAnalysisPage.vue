<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">命中分析</h2>
      <p class="text-sm text-muted-foreground">
        分析 QA 跟踪与 QA 管理之间的匹配情况，并同步统计到各个条目
      </p>
    </div>

    <Card class="p-6 space-y-6">
      <div class="space-y-4">
        <div class="grid gap-3 md:grid-cols-4 sm:grid-cols-2">
          <div class="p-4 border rounded-lg">
            <p class="text-sm text-muted-foreground">完全命中</p>
            <p class="text-2xl font-bold mt-1">{{ stats?.exact ?? 0 }}</p>
          </div>
          <div class="p-4 border rounded-lg">
            <p class="text-sm text-muted-foreground">80% 命中</p>
            <p class="text-2xl font-bold mt-1">{{ stats?.high ?? 0 }}</p>
          </div>
          <div class="p-4 border rounded-lg">
            <p class="text-sm text-muted-foreground">60% 命中</p>
            <p class="text-2xl font-bold mt-1">{{ stats?.medium ?? 0 }}</p>
          </div>
          <div class="p-4 border rounded-lg">
            <p class="text-sm text-muted-foreground">未命中</p>
            <p class="text-2xl font-bold mt-1">{{ stats?.none ?? 0 }}</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-4 items-end">
          <div class="space-y-2">
            <label class="text-xs text-muted-foreground">应用</label>
            <Select v-model="selectedAppId">
              <SelectTrigger class="w-[200px]">
                <SelectValue placeholder="选择应用" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="app in apps" :key="app.id" :value="app.id">
                  {{ app.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <label class="text-xs text-muted-foreground">时间范围</label>
            <Select v-model="selectedRange">
              <SelectTrigger class="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">最近 24 小时</SelectItem>
                <SelectItem value="7d">最近 7 天</SelectItem>
                <SelectItem value="30d">最近 30 天</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <label class="text-xs text-muted-foreground">分析模型</label>
            <Select v-model="selectedModelId">
              <SelectTrigger class="w-[220px]">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="model in models"
                  :key="model.id"
                  :value="model.id"
                >
                  {{ model.name }} · {{ model.model }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            :disabled="!selectedAppId || !selectedModelId || running"
            @click="runAnalysis"
          >
            {{ running ? '分析中...' : '开始分析' }}
          </Button>
        </div>
        <p v-if="lastRunWindow" class="text-xs text-muted-foreground">
          最近分析窗口：{{ formatDate(lastRunWindow.startDate) }} - {{ formatDate(lastRunWindow.endDate) }}
        </p>
      </div>

      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold">最近命中记录</h3>
          <div class="flex items-center gap-2">
            <Input
              v-model="globalFilter"
              placeholder="搜索 QA ID"
              class="w-[240px]"
              @keyup.enter="table.setPageIndex(0)"
            />
            <DataTableViewOptions :table="table" />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
              <TableHead v-for="header in headerGroup.headers" :key="header.id">
                <span v-if="header.isPlaceholder" />
                <FlexRender
                  v-else
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="table.getRowModel().rows.length === 0">
              <TableCell :colspan="table.getAllColumns().length" class="h-24 text-center text-muted-foreground">
                暂无分析记录，执行任务后可在此查看。
              </TableCell>
            </TableRow>
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
            >
              <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <DataTablePagination :table="table" class="pt-2" />
      </div>
    </Card>

  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, h } from 'vue'
import type { ColumnDef, SortingState, FilterFn } from '@tanstack/vue-table'
import { FlexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import {
  fetchApps,
  fetchHitAnalyses,
  fetchHitAnalysisStats,
  runHitAnalysis,
  fetchModels
} from '@/lib/api'
import type { App, HitAnalysis, ModelConfig } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableColumnHeader, DataTablePagination, DataTableViewOptions } from '@/components/ui/data-table'

const apps = ref<App[]>([])
const models = ref<ModelConfig[]>([])
const hitAnalyses = ref<HitAnalysis[]>([])
const stats = ref<{ exact: number; high: number; medium: number; none: number; total: number } | null>(null)
const selectedAppId = ref('')
const selectedRange = ref<'24h' | '7d' | '30d'>('24h')
const selectedModelId = ref('')
const running = ref(false)
const lastRunWindow = ref<{ startDate: string; endDate: string } | null>(null)
const globalFilter = ref('')
const sorting = ref<SortingState>([{ id: 'createdAt', desc: true }])

const globalFilterFn: FilterFn<HitAnalysis> = (row, _columnId, filterValue) => {
  const search = String(filterValue || '').toLowerCase()
  if (!search) return true
  const queryRecordId = String(row.original.queryRecordId || '').toLowerCase()
  return queryRecordId.includes(search)
}

async function loadApps() {
  try {
    apps.value = await fetchApps()
    if (!selectedAppId.value && apps.value.length > 0) {
      selectedAppId.value = apps.value[0].id
    }
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

async function loadModels() {
  try {
    models.value = await fetchModels()
    if (!selectedModelId.value && models.value.length > 0) {
      selectedModelId.value = models.value[0].id
    }
  } catch (error) {
    console.error('Failed to load models:', error)
  }
}

async function loadHitAnalysesList() {
  try {
    hitAnalyses.value = await fetchHitAnalyses({
      appId: selectedAppId.value || undefined,
      range: selectedRange.value
    })
  } catch (error) {
    console.error('Failed to load hit analyses:', error)
  }
}

async function refreshStats() {
  if (!selectedAppId.value) {
    stats.value = null
    return
  }
  try {
    const result = await fetchHitAnalysisStats({
      appId: selectedAppId.value,
      range: selectedRange.value
    })
    stats.value = result
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
}

const recentAnalyses = computed(() => {
  return [...hitAnalyses.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})

const columns = computed<ColumnDef<HitAnalysis>[]>(() => [
  {
    accessorKey: 'queryRecordId',
    header: 'QA ID',
    cell: ({ row }) => row.getValue('queryRecordId')
  },
  {
    accessorKey: 'matchType',
    header: '命中类型',
    cell: ({ row }) => {
      const matchType = row.getValue('matchType') as HitAnalysis['matchType']
      const similarity = row.original.similarity
      return h('div', { class: 'space-y-1' }, [
        h('span', { class: 'font-medium' }, matchTypeLabel(matchType)),
        h('span', { class: 'text-xs text-muted-foreground' }, `相似度: ${similarity}%`)
      ])
    }
  },
  {
    accessorKey: 'analysisResult',
    header: '时间范围',
    cell: ({ row }) => row.original.analysisResult?.range || '—'
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '创建时间' }),
    cell: ({ row }) => formatDate(String(row.getValue('createdAt')))
  }
])

const table = useVueTable({
  data: recentAnalyses,
  columns: columns.value,
  state: {
    get sorting() { return sorting.value },
    get globalFilter() { return globalFilter.value }
  },
  onSortingChange: updater => sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater,
  onGlobalFilterChange: value => { globalFilter.value = value as string },
  globalFilterFn,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: {
    pagination: { pageSize: 10, pageIndex: 0 }
  }
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

async function runAnalysis() {
  if (!selectedAppId.value || !selectedModelId.value) {
    alert('请选择应用和模型')
    return
  }
  running.value = true
  try {
    const result = await runHitAnalysis({
      appId: selectedAppId.value,
      range: selectedRange.value,
      modelId: selectedModelId.value
    })
    lastRunWindow.value = {
      startDate: result.startDate,
      endDate: result.endDate
    }
    await Promise.all([refreshStats(), loadHitAnalysesList()])
    alert('命中分析已完成')
  } catch (error) {
    console.error('Failed to run analysis:', error)
    alert('分析失败')
  } finally {
    running.value = false
  }
}

watch([selectedAppId, selectedRange], async () => {
  await Promise.all([refreshStats(), loadHitAnalysesList()])
})

onMounted(async () => {
  await Promise.all([loadApps(), loadModels()])
  await Promise.all([refreshStats(), loadHitAnalysesList()])
})
</script>
