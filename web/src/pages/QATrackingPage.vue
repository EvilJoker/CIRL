<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">问答（QA）跟踪</h2>
      <p class="text-sm text-muted-foreground">
        记录所有实时问答，支持筛选与一键加入 QA 管理
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
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline" size="sm" class="gap-2">
              <span>状态</span>
              <span v-if="selectedStatus" class="ml-1 text-xs text-muted-foreground">
                {{ getStatusLabel(selectedStatus) }}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[200px] p-0" align="start">
            <div class="p-2">
              <Input
                v-model="statusSearch"
                placeholder="搜索状态..."
                class="h-8 mb-2"
              />
            </div>
            <div class="max-h-[300px] overflow-auto">
              <div class="p-1">
                <label class="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer">
                  <input
                    type="radio"
                    :checked="selectedStatus === ''"
                    @change="selectedStatus = ''; handleFilterChange()"
                    class="rounded"
                  />
                  <span class="text-sm">全部状态</span>
                </label>
                <label
                  v-for="status in filteredStatuses"
                  :key="status.value"
                  class="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                >
                  <input
                    type="radio"
                    :checked="selectedStatus === status.value"
                    @change="selectedStatus = status.value; handleFilterChange()"
                    class="rounded"
                  />
                  <span class="text-sm">{{ status.label }}</span>
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
        暂无问答记录
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

    <!-- 内容查看对话框 -->
    <Dialog :open="showContentModal" @update:open="showContentModal = $event">
      <DialogContent class="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{{ contentDialogTitle }}</DialogTitle>
        </DialogHeader>
        <div class="max-h-[70vh] overflow-auto">
          <div class="bg-muted p-4 rounded-lg border">
            <pre class="whitespace-pre-wrap text-sm leading-relaxed">{{ contentDialogContent }}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showContentModal = false">关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import type { ColumnDef, SortingState, ColumnFiltersState, FilterFn } from '@tanstack/vue-table'
import { FlexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import { fetchApps, fetchQueryRecords } from '@/lib/api'
import type { App, QueryRecord } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableColumnHeader, DataTablePagination } from '@/components/ui/data-table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const apps = ref<App[]>([])
const records = ref<QueryRecord[]>([])
const loading = ref(false)
const selectedAppId = ref('all')
const startDate = ref('')
const endDate = ref('')
const globalFilter = ref('')
const appSearch = ref('')
const statusSearch = ref('')
const selectedStatus = ref<string>('')

// 状态选项配置（可配置）
const statusOptions = [
  { value: 'curated', label: '已纳入 QA 管理' },
  { value: 'notCurated', label: '未纳入 QA' },
  { value: 'analyzed', label: '已分析' },
  { value: 'pending', label: '待分析' },
  { value: 'ignored', label: '已忽略' }
]

const filteredStatuses = computed(() => {
  if (!statusSearch.value.trim()) return statusOptions
  const keyword = statusSearch.value.trim().toLowerCase()
  return statusOptions.filter(status => status.label.toLowerCase().includes(keyword))
})

function getStatusLabel(value: string) {
  if (!value) return ''
  const status = statusOptions.find(s => s.value === value)
  return status?.label || value
}

const showContentModal = ref(false)
const contentDialogTitle = ref('')
const contentDialogContent = ref('')
const exportLoading = ref(false)
const sorting = ref<SortingState>([{ id: 'createdAt', desc: true }])
const columnFilters = ref<ColumnFiltersState>([])

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
    page: pageOverride ?? 1,
    pageSize: pageSizeOverride ?? 200
  }
  if (selectedAppId.value !== 'all') params.appId = selectedAppId.value
  if (startDate.value) params.startDate = startDate.value
  if (endDate.value) params.endDate = endDate.value
  return params
}

async function loadRecords() {
  loading.value = true
  try {
    const result = await fetchQueryRecords(buildQueryParams(1, 200))
    records.value = result.data
  } catch (error) {
    console.error('Failed to load records:', error)
  } finally {
    loading.value = false
  }
}

const columns = computed<ColumnDef<QueryRecord>[]>(() => [
  {
    accessorKey: 'appId',
    header: '应用',
    cell: ({ row }) => h(Badge, { variant: row.original.ignored ? 'outline' : 'secondary' }, () => getAppName(row.getValue('appId')))
  },
  {
    id: 'status',
    header: '状态',
    cell: ({ row }) => {
      const record = row.original
      // 根据状态配置显示唯一状态
      if (record.ignored) {
        return h(Badge, { variant: 'outline' }, () => '已忽略')
      }
      if (record.curated) {
        return h(Badge, { variant: 'default' }, () => '已纳入 QA 管理')
      }
      if (record.metadata?.lastAnalyzedAt) {
        return h(Badge, { variant: 'default' }, () => '已分析')
      }
      return h(Badge, { variant: 'outline' }, () => '待分析')
    }
  },
  {
    accessorKey: 'input',
    header: '输入',
    cell: ({ row }) => {
      const input = row.getValue('input') as string
      const truncated = input.length > 50 ? input.substring(0, 50) + '...' : input
      return h('div', {
        class: 'max-w-[300px] truncate cursor-pointer hover:text-primary',
        onClick: () => openContentDialog('输入', input)
      }, truncated)
    }
  },
  {
    accessorKey: 'output',
    header: '输出',
    cell: ({ row }) => {
      const output = row.getValue('output') as string
      const truncated = output.length > 50 ? output.substring(0, 50) + '...' : output
      return h('div', {
        class: 'max-w-[300px] truncate cursor-pointer hover:text-primary',
        onClick: () => openContentDialog('输出', output)
      }, truncated)
    }
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '创建时间' }),
    cell: ({ row }) => formatDate(String(row.getValue('createdAt')))
  },
  {
    id: 'tags',
    header: 'Tag 管理',
    cell: ({ row }) => {
      const tags = row.original.tags || []
      if (tags.length === 0) return h('span', { class: 'text-muted-foreground text-sm' }, '—')
      return h('div', { class: 'flex flex-wrap gap-1' }, tags.map(tag => h(Badge, { key: tag, variant: 'outline' }, () => `#${tag}`)))
    }
  },
])

const filteredRecords = computed(() => {
  let result = records.value.slice()

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

  // 状态筛选（单选）
  if (selectedStatus.value) {
    result = result.filter(record => {
      switch (selectedStatus.value) {
        case 'curated':
          return record.curated
        case 'notCurated':
          return !record.curated && !record.ignored
        case 'analyzed':
          return !!record.metadata?.lastAnalyzedAt
        case 'pending':
          return !record.metadata?.lastAnalyzedAt && !record.ignored
        case 'ignored':
          return record.ignored
        default:
          return true
      }
    })
  }

  return result
})

const table = useVueTable({
  data: filteredRecords,
  columns: columns.value,
  state: {
    get sorting() { return sorting.value },
    get columnFilters() { return columnFilters.value },
    get globalFilter() { return globalFilter.value }
  },
  onSortingChange: updater => sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater,
  onColumnFiltersChange: updater => columnFilters.value = typeof updater === 'function' ? updater(columnFilters.value) : updater,
  onGlobalFilterChange: value => { globalFilter.value = value as string },
  globalFilterFn,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: {
    pagination: { pageSize: 10, pageIndex: 0 }
  }
})

function handleFilterChange() {
  // 当应用或日期范围改变时，需要重新加载数据
  // 输入/输出筛选是前端筛选，不需要重新加载
  loadRecords()
}

function resetFilters() {
  selectedAppId.value = 'all'
  startDate.value = ''
  endDate.value = ''
  globalFilter.value = ''
  appSearch.value = ''
  statusSearch.value = ''
  selectedStatus.value = ''
  table.setPageIndex(0)
  handleFilterChange()
}

function openContentDialog(title: string, content: string) {
  contentDialogTitle.value = title
  contentDialogContent.value = content
  showContentModal.value = true
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

onMounted(() => {
  loadApps()
  loadRecords()
})
</script>

