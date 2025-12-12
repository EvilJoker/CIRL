<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">APP 管理</h2>
      <p class="text-sm text-muted-foreground">创建和管理应用</p>
    </div>

    <Card class="p-6 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold">应用列表</h3>
        <div class="flex items-center gap-2">
          <Input
            v-model="globalFilter"
            placeholder="搜索名称/ID"
            class="w-[240px]"
            @keyup.enter="table.setPageIndex(0)"
          />
          <DataTableViewOptions :table="table" />
          <Button @click="showCreateModal = true">
            创建应用
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
                暂无应用，点击"创建应用"开始
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

    <!-- 创建/编辑对话框 -->
    <Dialog :open="showCreateModal || !!editingApp" @update:open="handleDialogClose">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingApp ? '编辑应用' : '创建应用' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">名称</label>
            <Input v-model="formData.name" placeholder="输入应用名称" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">描述</label>
            <Textarea v-model="formData.description" placeholder="输入描述（可选）" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="handleDialogClose">取消</Button>
          <Button @click="handleSave">{{ editingApp ? '保存' : '创建' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue'
import type { ColumnDef, SortingState, FilterFn } from '@tanstack/vue-table'
import { FlexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import { fetchApps, createApp, updateApp, deleteApp as deleteAppApi, fetchRequestStats, type RequestStats } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { App } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableColumnHeader, DataTablePagination, DataTableViewOptions } from '@/components/ui/data-table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const apps = ref<App[]>([])
const stats = ref<Record<string, RequestStats>>({})
const loading = ref(false)
const showCreateModal = ref(false)
const editingApp = ref<App | null>(null)
const formData = ref({ name: '', description: '' })
const globalFilter = ref('')
const sorting = ref<SortingState>([{ id: 'createdAt', desc: true }])

const globalFilterFn: FilterFn<App> = (row, _columnId, filterValue) => {
  const search = String(filterValue || '').toLowerCase()
  if (!search) return true
  const name = String(row.original.name || '').toLowerCase()
  const id = String(row.original.id || '').toLowerCase()
  return name.includes(search) || id.includes(search)
}

const columns = computed<ColumnDef<App>[]>(() => [
  {
    accessorKey: 'name',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '名称' }),
    cell: ({ row }) => h('div', { class: 'flex items-center gap-2' }, [
      h('span', { class: 'font-semibold' }, row.getValue('name')),
      h('span', { class: 'text-xs text-muted-foreground font-mono' }, `ID: ${row.original.id}`)
    ])
  },
  {
    accessorKey: 'description',
    header: '描述',
    cell: ({ row }) => row.getValue('description') || '—'
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '创建时间' }),
    cell: ({ row }) => formatDate(String(row.getValue('createdAt')))
  },
  {
    id: 'stats',
    header: '请求统计',
    cell: ({ row }) => {
      const appId = row.original.id
      return h('div', { class: 'flex items-center gap-4 text-xs' }, [
        h('div', { class: 'flex items-center gap-1' }, [
          h('span', { class: 'text-muted-foreground' }, '24h:'),
          h('span', { class: 'font-semibold' }, String(getRequestCount(appId, '24h')))
        ]),
        h('div', { class: 'flex items-center gap-1' }, [
          h('span', { class: 'text-muted-foreground' }, '7d:'),
          h('span', { class: 'font-semibold' }, String(getRequestCount(appId, '7d')))
        ]),
        h('div', { class: 'flex items-center gap-1' }, [
          h('span', { class: 'text-muted-foreground' }, '30d:'),
          h('span', { class: 'font-semibold' }, String(getRequestCount(appId, '30d')))
        ])
      ])
    }
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
                class: 'justify-start w-full',
                onClick: () => editApp(row.original)
              }, '编辑'),
              h(Button, {
                size: 'sm',
                variant: 'ghost',
                class: 'justify-start w-full text-destructive',
                onClick: () => deleteApp(row.original.id)
              }, '删除')
            ])
          ])
        ]
      })
  }
])

const table = useVueTable({
  data: apps,
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
  loading.value = true
  try {
    apps.value = await fetchApps()
    // 加载统计数据
    if (apps.value.length > 0) {
      const appIds = apps.value.map(app => app.id)
      stats.value = await fetchRequestStats(appIds)
    }
  } catch (error) {
    console.error('Failed to load apps:', error)
  } finally {
    loading.value = false
  }
}

function getRequestCount(appId: string, period: '24h' | '7d' | '30d'): number {
  const stat = stats.value[appId]
  if (!stat) return 0
  switch (period) {
    case '24h':
      return stat.count24h
    case '7d':
      return stat.count7d
    case '30d':
      return stat.count30d
    default:
      return 0
  }
}

function editApp(app: App) {
  editingApp.value = app
  formData.value = { name: app.name, description: app.description || '' }
}

async function handleSave() {
  if (!formData.value.name.trim()) return

  try {
    if (editingApp.value) {
      await updateApp(editingApp.value.id, formData.value)
    } else {
      await createApp(formData.value)
    }
    handleDialogClose()
    loadApps()
  } catch (error) {
    console.error('Failed to save app:', error)
    alert('保存失败')
  }
}

async function deleteApp(id: string) {
  if (!confirm('确定要删除这个应用吗？')) return
  try {
    await deleteAppApi(id)
    loadApps()
  } catch (error) {
    console.error('Failed to delete app:', error)
    alert('删除失败')
  }
}

function handleDialogClose() {
  showCreateModal.value = false
  editingApp.value = null
  formData.value = { name: '', description: '' }
}

onMounted(() => {
  loadApps()
})
</script>

