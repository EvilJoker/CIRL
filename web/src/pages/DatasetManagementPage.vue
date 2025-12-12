<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">数据集管理</h2>
      <p class="text-sm text-muted-foreground">创建和管理数据集（标准答案集）</p>
    </div>

    <Card class="p-6 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold">数据集列表</h3>
        <div class="flex items-center gap-2">
          <Input
            v-model="globalFilter"
            placeholder="搜索名称/描述"
            class="w-[240px]"
            @keyup.enter="table.setPageIndex(0)"
          />
          <DataTableViewOptions :table="table" />
          <Button @click="showCreateModal = true">
            创建数据集
          </Button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-8 text-muted-foreground">
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
                暂无数据集
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

    <!-- 创建数据集对话框 -->
    <Dialog :open="showCreateModal" @update:open="showCreateModal = $event">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>创建数据集</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">应用</label>
            <Select v-model="createForm.appId">
              <SelectTrigger>
                <SelectValue placeholder="选择应用" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="app in apps" :key="app.id" :value="app.id">
                  {{ app.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">名称</label>
            <Input v-model="createForm.name" placeholder="数据集名称" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">描述</label>
            <Textarea v-model="createForm.description" placeholder="描述（可选）" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">选择问答记录</label>
            <p class="text-xs text-muted-foreground mb-2">
              已选择 {{ selectedRecordIds.length }} 条记录
            </p>
            <div class="border rounded-lg p-4 max-h-[300px] overflow-auto">
              <div v-if="availableRecords.length === 0" class="text-sm text-muted-foreground">
                暂无可用记录
              </div>
              <div v-else class="space-y-2">
                <label
                  v-for="record in availableRecords"
                  :key="record.id"
                  class="flex items-start gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :value="record.id"
                    v-model="selectedRecordIds"
                    class="mt-1"
                  />
                  <div class="flex-1">
                    <p class="text-sm">{{ record.input }}</p>
                    <p class="text-xs text-muted-foreground mt-1">{{ record.output.substring(0, 50) }}...</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateModal = false">取消</Button>
          <Button @click="handleCreate">创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, h } from 'vue'
import type { ColumnDef, SortingState, FilterFn } from '@tanstack/vue-table'
import { FlexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import { fetchApps, fetchDatasets, createDataset, deleteDataset as deleteDatasetApi, fetchQueryRecords } from '@/lib/api'
import type { App, Dataset, QueryRecord } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableColumnHeader, DataTablePagination, DataTableViewOptions } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const apps = ref<App[]>([])
const datasets = ref<Dataset[]>([])
const availableRecords = ref<QueryRecord[]>([])
const loading = ref(false)
const showCreateModal = ref(false)
const createForm = ref({ appId: '', name: '', description: '' })
const selectedRecordIds = ref<string[]>([])
const globalFilter = ref('')
const sorting = ref<SortingState>([{ id: 'createdAt', desc: true }])

const globalFilterFn: FilterFn<Dataset> = (row, _columnId, filterValue) => {
  const search = String(filterValue || '').toLowerCase()
  if (!search) return true
  const name = String(row.original.name || '').toLowerCase()
  const description = String(row.original.description || '').toLowerCase()
  return name.includes(search) || description.includes(search)
}

const columns = computed<ColumnDef<Dataset>[]>(() => [
  {
    accessorKey: 'name',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '名称' }),
    cell: ({ row }) => row.getValue('name')
  },
  {
    accessorKey: 'description',
    header: '描述',
    cell: ({ row }) => row.getValue('description') || '—'
  },
  {
    id: 'recordCount',
    header: 'QA 数量',
    cell: ({ row }) => h(Badge, null, () => `${row.original.queryRecordIds.length} 条`)
  },
  {
    id: 'actions',
    header: '操作',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) =>
      h(Popover, {}, {
        default: () => [
          h(PopoverTrigger, { asChild: true }, () =>
            h(Button, {
              size: 'sm',
              variant: 'ghost',
              class: 'h-8 w-8 p-0'
            }, () => h('span', { class: 'text-lg' }, '⋯'))
          ),
          h(PopoverContent, { align: 'end', class: 'w-[160px]' }, () => [
            h('div', { class: 'flex flex-col gap-1' }, [
              h(Button, {
                size: 'sm',
                variant: 'ghost',
                class: 'justify-start w-full text-destructive',
                onClick: () => deleteDataset(row.original.id)
              }, '删除')
            ])
          ])
        ]
      })
  }
])

const table = useVueTable({
  data: datasets,
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

async function loadApps() {
  try {
    apps.value = await fetchApps()
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

async function loadDatasets() {
  loading.value = true
  try {
    datasets.value = await fetchDatasets()
  } catch (error) {
    console.error('Failed to load datasets:', error)
  } finally {
    loading.value = false
  }
}

async function loadRecords() {
  if (!createForm.value.appId) return
  try {
    const result = await fetchQueryRecords({ appId: createForm.value.appId })
    availableRecords.value = result.data
  } catch (error) {
    console.error('Failed to load records:', error)
  }
}

watch(() => createForm.value.appId, () => {
  loadRecords()
  selectedRecordIds.value = []
})

async function handleCreate() {
  if (!createForm.value.appId || !createForm.value.name || selectedRecordIds.value.length === 0) {
    alert('请填写完整信息并选择至少一条记录')
    return
  }
  try {
    await createDataset({
      appId: createForm.value.appId,
      name: createForm.value.name,
      description: createForm.value.description,
      queryRecordIds: selectedRecordIds.value
    })
    showCreateModal.value = false
    createForm.value = { appId: '', name: '', description: '' }
    selectedRecordIds.value = []
    loadDatasets()
  } catch (error) {
    console.error('Failed to create dataset:', error)
    alert('创建失败')
  }
}

async function deleteDataset(id: string) {
  if (!confirm('确定要删除这个数据集吗？')) return
  try {
    await deleteDatasetApi(id)
    loadDatasets()
  } catch (error) {
    console.error('Failed to delete dataset:', error)
    alert('删除失败')
  }
}

onMounted(() => {
  loadApps()
  loadDatasets()
})
</script>

