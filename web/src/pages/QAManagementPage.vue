<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">问答（QA）管理</h2>
      <p class="text-sm text-muted-foreground">
        管理精心检验的 QA，编辑答案和标签
      </p>
    </div>

    <Card class="p-5 space-y-4">
      <div class="flex items-center gap-2">
        <Input
          v-model="globalFilter"
          placeholder="筛选问答（输入/输出）..."
          class="max-w-sm"
          @keyup.enter="table.setPageIndex(0)"
        />
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline" size="sm" class="gap-2">
              <span>应用</span>
              <span v-if="selectedAppId !== 'all'" class="ml-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                {{ getSelectedAppCount() }}
              </span>
        </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[200px] p-0" align="start">
            <div class="p-2">
              <Input
                v-model="appSearch"
                placeholder="搜索应用..."
                class="h-8 mb-2"
              />
            </div>
            <div class="max-h-[300px] overflow-auto">
              <div class="p-1">
                <label class="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer">
                  <input
                    type="radio"
                    :checked="selectedAppId === 'all'"
                    @change="selectedAppId = 'all'; handleFilterChange()"
                    class="rounded"
                  />
                  <span class="text-sm">全部应用</span>
                </label>
                <label
                  v-for="app in filteredApps"
                  :key="app.id"
                  class="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                >
                  <input
                    type="radio"
                    :checked="selectedAppId === app.id"
                    @change="selectedAppId = app.id; handleFilterChange()"
                    class="rounded"
                  />
                  <span class="text-sm">{{ app.name }}</span>
                </label>
              </div>
      </div>
          </PopoverContent>
        </Popover>
        <div class="ml-auto flex items-center gap-2">
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
      </div>

      <div v-if="loading" class="text-center py-6 text-muted-foreground">
        加载中...
      </div>
      <div v-else>
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
                暂无 QA
              </TableCell>
            </TableRow>
            <template v-for="row in table.getRowModel().rows" :key="row.id">
              <TableRow>
                <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </TableCell>
              </TableRow>
              <TableRow v-if="row.getIsExpanded()">
                <TableCell :colspan="table.getAllColumns().length" class="bg-muted/50 p-4">
                  <div class="space-y-4">
          <div>
                      <label class="text-sm font-medium text-muted-foreground mb-1 block">输入</label>
                      <Textarea v-model="editCache[row.original.id].input" rows="2" />
          </div>
          <div>
                      <label class="text-sm font-medium text-muted-foreground mb-1 block">输出</label>
                      <Textarea v-model="editCache[row.original.id].output" rows="3" />
          </div>
          <div class="space-y-2">
            <p class="text-sm font-medium text-muted-foreground">Tags</p>
            <div class="flex flex-wrap gap-2">
                        <Badge v-for="tag in row.original.tags || []" :key="tag" variant="outline">
                #{{ tag }}
              </Badge>
                        <span v-if="!row.original.tags || row.original.tags.length === 0" class="text-xs text-muted-foreground">暂无标签</span>
            </div>
            <div class="flex gap-2">
              <Input
                          v-model="tagInputCache[row.original.id]"
                placeholder="输入标签，逗号分隔"
              />
                        <Button size="sm" variant="secondary" @click="saveTags(row.original)">更新标签</Button>
            </div>
          </div>
                    <div class="flex justify-end">
                      <Button size="sm" variant="outline" @click="saveRecord(row.original)">
                        保存修改
            </Button>
          </div>
        </div>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
        <DataTablePagination :table="table" class="pt-2" />
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import type { ColumnDef, SortingState, ExpandedState, ColumnFiltersState, FilterFn } from '@tanstack/vue-table'
import { FlexRender, getCoreRowModel, getExpandedRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import { fetchApps, fetchQueryRecords, fetchHitAnalyses, updateQueryRecord } from '@/lib/api'
import type { App, QueryRecord, HitAnalysis } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTablePagination } from '@/components/ui/data-table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronRight } from 'lucide-vue-next'

const ChevronRightIcon = ChevronRight

const apps = ref<App[]>([])
const records = ref<QueryRecord[]>([])
const hitAnalyses = ref<HitAnalysis[]>([])
const loading = ref(false)

const selectedAppId = ref('all')
const startDate = ref('')
const endDate = ref('')
const globalFilter = ref('')
const appSearch = ref('')

const editCache = ref<Record<string, { input: string; output: string }>>({})
const tagInputCache = ref<Record<string, string>>({})
const exportLoading = ref(false)
const expanded = ref<ExpandedState>({})
const sorting = ref<SortingState>([{ id: 'createdAt', desc: true }])
const columnFilters = ref<ColumnFiltersState>([])

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

const filteredApps = computed(() => {
  if (!appSearch.value.trim()) return apps.value
  const keyword = appSearch.value.trim().toLowerCase()
  return apps.value.filter(app => app.name.toLowerCase().includes(keyword))
})

function getSelectedAppCount() {
  return selectedAppId.value !== 'all' ? 1 : 0
}

const globalFilterFn: FilterFn<QueryRecord> = (row, _columnId, filterValue) => {
  const search = String(filterValue || '').toLowerCase()
  if (!search) return true
  const input = String(row.original.input || '').toLowerCase()
  const output = String(row.original.output || '').toLowerCase()
  return input.includes(search) || output.includes(search)
}

const filteredRecords = computed(() => {
  let result = curatedRecords.value.slice()

  // 应用筛选
  if (selectedAppId.value !== 'all') {
    result = result.filter(record => record.appId === selectedAppId.value)
  }

  // 日期筛选
  if (startDate.value) {
    const start = new Date(startDate.value).getTime()
    result = result.filter(record => new Date(record.createdAt).getTime() >= start)
  }

  if (endDate.value) {
    const end = new Date(endDate.value).getTime() + 24 * 60 * 60 * 1000 - 1
    result = result.filter(record => new Date(record.createdAt).getTime() <= end)
  }

  // 全局搜索筛选
  if (globalFilter.value.trim()) {
    const keyword = globalFilter.value.trim().toLowerCase()
    result = result.filter(record =>
      (record.input || '').toLowerCase().includes(keyword) ||
      (record.output || '').toLowerCase().includes(keyword)
    )
  }

  return result
})

const columns = computed<ColumnDef<QueryRecord>[]>(() => [
  {
    id: 'expand',
    header: '',
    cell: ({ row }) =>
      h(Button, {
        variant: 'ghost',
        size: 'sm',
        class: 'h-8 w-8 p-0',
        onClick: () => row.toggleExpanded()
      }, () => h(ChevronRightIcon, { class: `h-4 w-4 transition-transform ${row.getIsExpanded() ? 'rotate-90' : ''}` }))
  },
  {
    accessorKey: 'appId',
    header: '应用',
    cell: ({ row }) => h(Badge, null, () => getAppName(row.getValue('appId')))
  },
  {
    id: 'hitSummary',
    header: '命中统计',
    cell: ({ row }) => h(Badge, { variant: 'secondary' }, () => `命中：${getHitSummary(row.original.id)}`)
  },
  {
    accessorKey: 'input',
    header: '输入',
    cell: ({ row }) => h('div', { class: 'max-w-[300px] truncate', title: row.getValue('input') }, row.getValue('input'))
  },
  {
    accessorKey: 'output',
    header: '输出',
    cell: ({ row }) => h('div', { class: 'max-w-[300px] truncate', title: row.getValue('output') }, row.getValue('output'))
  },
  {
    id: 'lastAnalyzed',
    header: '最近分析',
    cell: ({ row }) => {
      const lastAnalyzed = row.original.metadata?.lastAnalyzedAt
      return lastAnalyzed ? formatDate(lastAnalyzed) : '—'
    }
  },
  {
    id: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags = row.original.tags || []
      if (tags.length === 0) return '—'
      return h('div', { class: 'flex flex-wrap gap-1' }, tags.map(tag => h(Badge, { key: tag, variant: 'outline' }, () => `#${tag}`)))
    }
  }
])

const table = useVueTable({
  data: filteredRecords,
  columns: columns.value,
  state: {
    get sorting() { return sorting.value },
    get expanded() { return expanded.value },
    get columnFilters() { return columnFilters.value },
    get globalFilter() { return globalFilter.value }
  },
  onSortingChange: updater => sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater,
  onExpandedChange: updater => expanded.value = typeof updater === 'function' ? updater(expanded.value) : updater,
  onColumnFiltersChange: updater => columnFilters.value = typeof updater === 'function' ? updater(columnFilters.value) : updater,
  onGlobalFilterChange: updater => globalFilter.value = typeof updater === 'function' ? updater(globalFilter.value) : updater,
  globalFilterFn,
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: {
    pagination: { pageSize: 10, pageIndex: 0 }
  }
})

function getAppName(appId: string) {
  const app = apps.value.find(a => a.id === appId)
  return app?.name || appId
}

function getHitSummary(recordId: string) {
  const summary = hitSummaryMap.value[recordId]
  if (!summary) return '无分析'
  return `exact:${summary.exact} / high:${summary.high} / mid:${summary.medium} / none:${summary.none}`
}

function handleFilterChange() {
  table.setPageIndex(0)
}

function resetFilters() {
  selectedAppId.value = 'all'
  startDate.value = ''
  endDate.value = ''
  globalFilter.value = ''
  appSearch.value = ''
  table.setPageIndex(0)
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
    const pageSize = 200
    let page = 1
    const all: QueryRecord[] = []
    while (true) {
      const result = await fetchQueryRecords({ curated: true, page, pageSize })
      all.push(...result.data)
      if (all.length >= result.total) break
      if (result.data.length === 0) break
      page += 1
    }
    records.value = all
    // 初始化编辑缓存
    all.forEach(record => {
      if (!editCache.value[record.id]) {
        editCache.value[record.id] = { input: record.input, output: record.output }
      }
      if (tagInputCache.value[record.id] === undefined) {
        tagInputCache.value[record.id] = (record.tags || []).join(', ')
      }
    })
  } catch (error) {
    console.error('Failed to load records:', error)
  } finally {
    loading.value = false
  }
}

async function loadHitAnalysesData() {
  try {
    hitAnalyses.value = await fetchHitAnalyses()
  } catch (error) {
    console.error('Failed to load hit analyses:', error)
  }
}


async function exportRecords() {
  exportLoading.value = true
  try {
    const data = filteredRecords.value
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `qa-management-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export QA records:', error)
    alert('导出失败')
  } finally {
    exportLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadApps(), loadRecords(), loadHitAnalysesData()])
})
</script>

