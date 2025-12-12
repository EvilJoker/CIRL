<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">模型管理</h2>
      <p class="text-sm text-muted-foreground">
        配置命中分析等功能可复用的 OpenAI 兼容模型
      </p>
    </div>

    <Card class="p-6 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold">模型列表</h3>
          <p class="text-sm text-muted-foreground">
            支持多个模型配置，分析时可按需选择
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Input
            v-model="globalFilter"
            placeholder="搜索名称/模型/Provider"
            class="w-[240px]"
            @keyup.enter="table.setPageIndex(0)"
          />
          <DataTableViewOptions :table="table" />
          <Button @click="openDialog()">新建模型</Button>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-muted-foreground">加载中...</div>
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
                暂无模型，请先创建配置。
              </TableCell>
            </TableRow>
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              :data-state="row.getIsSelected() ? 'selected' : undefined"
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

    <Dialog :open="showDialog" @update:open="showDialog = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingModel ? '编辑模型' : '新建模型' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">名称</label>
            <Input v-model="form.name" placeholder="如：OpenAI 默认模型" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">模型 ID</label>
            <Input v-model="form.model" placeholder="如：gpt-4o-mini" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Base URL</label>
            <Input v-model="form.baseUrl" placeholder="https://api.openai.com/v1" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">API Key</label>
            <Input v-model="form.apiKey" type="password" placeholder="sk-..." />
          </div>
        </div>
        <DialogFooter class="gap-2">
          <Button variant="outline" @click="showDialog = false">取消</Button>
          <Button @click="saveModel" :disabled="!form.name || !form.model">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, h } from 'vue'
import type { ColumnDef, ColumnFiltersState, SortingState, FilterFn } from '@tanstack/vue-table'
import { FlexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { fetchModels, createModel, updateModel, deleteModel } from '@/lib/api'
import type { ModelConfig } from '@/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableColumnHeader, DataTablePagination, DataTableViewOptions } from '@/components/ui/data-table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const models = ref<ModelConfig[]>([])
const loading = ref(false)
const showDialog = ref(false)
const editingModel = ref<ModelConfig | null>(null)
const form = ref({
  name: '',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: ''
})
const globalFilter = ref('')
const sorting = ref<SortingState>([{ id: 'createdAt', desc: true }])
const columnFilters = ref<ColumnFiltersState>([])

const globalFilterFn: FilterFn<ModelConfig> = (row, columnId, filterValue) => {
  const search = String(filterValue || '').toLowerCase()
  if (!search) return true
  const value = String(row.getValue(columnId) ?? '').toLowerCase()
  return value.includes(search)
}

const columns = computed<ColumnDef<ModelConfig>[]>(() => [
  {
    accessorKey: 'name',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '名称' }),
    cell: ({ row }) => row.getValue('name'),
  },
  {
    accessorKey: 'model',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '模型 ID' }),
    cell: ({ row }) => row.getValue('model'),
  },
  {
    accessorKey: 'provider',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Provider' }),
    cell: ({ row }) => row.getValue('provider'),
  },
  {
    accessorKey: 'baseUrl',
    header: 'Base URL',
    cell: ({ row }) => row.getValue('baseUrl'),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '创建时间' }),
    cell: ({ row }) => formatDate(String(row.getValue('createdAt'))),
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
                onClick: () => openDialog(row.original)
              }, '编辑'),
              h(Button, {
                size: 'sm',
                variant: 'ghost',
                class: 'justify-start w-full text-destructive',
                onClick: () => removeModel(row.original)
              }, '删除')
            ])
          ])
        ]
      })
  }
])

const table = useVueTable({
  data: models,
  columns: columns.value,
  state: {
    get sorting() { return sorting.value },
    get columnFilters() { return columnFilters.value },
    get globalFilter() { return globalFilter.value },
  },
  globalFilterFn,
  onSortingChange: updater => sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater,
  onColumnFiltersChange: updater => columnFilters.value = typeof updater === 'function' ? updater(columnFilters.value) : updater,
  onGlobalFilterChange: value => { globalFilter.value = value as string },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: {
    pagination: {
      pageSize: 10,
      pageIndex: 0
    }
  }
})

async function loadModels() {
  loading.value = true
  try {
    models.value = await fetchModels()
  } catch (error) {
    console.error('Failed to load models:', error)
    alert('加载失败')
  } finally {
    loading.value = false
  }
}

function openDialog(model?: ModelConfig) {
  editingModel.value = model ?? null
  form.value = {
    name: model?.name ?? '',
    provider: model?.provider ?? 'openai',
    baseUrl: model?.baseUrl ?? 'https://api.openai.com/v1',
    apiKey: model?.apiKey ?? '',
    model: model?.model ?? ''
  }
  showDialog.value = true
}

async function saveModel() {
  try {
    if (editingModel.value) {
      await updateModel(editingModel.value.id, form.value)
    } else {
      await createModel(form.value)
    }
    showDialog.value = false
    await loadModels()
  } catch (error) {
    console.error('Failed to save model:', error)
    alert('保存失败')
  }
}

async function removeModel(model: ModelConfig) {
  if (!confirm(`确定删除模型「${model.name}」吗？`)) return
  try {
    await deleteModel(model.id)
    await loadModels()
  } catch (error) {
    console.error('Failed to delete model:', error)
    alert('删除失败')
  }
}

onMounted(() => {
  loadModels()
})
</script>

