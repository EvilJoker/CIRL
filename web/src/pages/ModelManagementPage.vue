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

  <Dialog :open="showTestDialog" @update:open="showTestDialog = $event">
    <DialogContent class="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>模型连通性测试</DialogTitle>
      </DialogHeader>
      <div class="space-y-4 text-sm">
        <!-- 模型信息 -->
        <div v-if="testingModel">
          <p class="font-medium mb-2">模型信息</p>
          <div class="bg-muted rounded p-3 space-y-1">
            <div class="flex justify-between">
              <span class="text-muted-foreground">名称：</span>
              <span class="font-medium">{{ testingModel.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">模型 ID：</span>
              <span class="font-medium">{{ testingModel.model }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Provider：</span>
              <span class="font-medium">{{ testingModel.provider }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Base URL：</span>
              <span class="font-medium break-all">{{ testingModel.baseUrl }}</span>
            </div>
          </div>
        </div>

        <!-- 请求信息 -->
        <div>
          <p class="font-medium mb-2">请求</p>
          <div class="space-y-3">
            <div>
              <p class="text-xs text-muted-foreground mb-1">后端测试 API</p>
              <pre class="bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap text-xs">{{ JSON.stringify(testRequest?.backend, null, 2) }}</pre>
            </div>
            <div>
              <p class="text-xs text-muted-foreground mb-1">实际模型 API 调用（curl 命令）</p>
              <pre class="bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap text-xs font-mono">{{ curlCommand }}</pre>
            </div>
          </div>
        </div>

        <!-- 响应信息 -->
        <div>
          <p class="font-medium mb-2">响应</p>
          <div v-if="testLoading" class="text-muted-foreground py-3">请求中...</div>
          <pre v-else-if="testResponse" class="bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap text-xs">{{ JSON.stringify(testResponse, null, 2) }}</pre>
          <div
            v-if="testSuccess !== null && !testLoading"
            :class="testSuccess ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'"
            class="border rounded p-3 mt-2"
          >
            <p class="font-medium">
              {{ testSuccess ? '✓ 模型可用' : '✗ 模型不可用' }}
            </p>
            <p v-if="testResponse?.message" class="text-sm mt-1 opacity-90">
              {{ testResponse.message }}
            </p>
          </div>
        </div>
      </div>
      <DialogFooter class="gap-2">
        <Button
          variant="outline"
          @click="showTestDialog = false"
        >
          关闭
        </Button>
        <Button
          v-if="testingModel"
          @click="retryTest"
          :disabled="testLoading"
        >
          {{ testLoading ? '测试中...' : '测试连接' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
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
import { fetchModels, createModel, updateModel, deleteModel, testModel } from '@/lib/api'
import type { ModelConfig } from '@/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableColumnHeader, DataTablePagination, DataTableViewOptions } from '@/components/ui/data-table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const models = ref<ModelConfig[]>([])
const loading = ref(false)
const showDialog = ref(false)
const editingModel = ref<ModelConfig | null>(null)
const testingId = ref<string | null>(null)
const testingModel = ref<ModelConfig | null>(null)
const showTestDialog = ref(false)
const testRequest = ref<any>(null)
const testResponse = ref<any>(null)
const testSuccess = ref<boolean | null>(null)
const testLoading = ref(false)
const curlCommand = ref('')
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
                disabled: testingId.value === row.original.id,
                onClick: () => handleTest(row.original)
              }, testingId.value === row.original.id ? '测试中...' : '测试'),
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

function generateCurlCommand(model: ModelConfig): string {
  const baseUrlClean = model.baseUrl.replace(/\/$/, '')
  const url = `${baseUrlClean}/chat/completions`
  const payload = {
    model: model.model,
      messages: [
      {
        role: 'user',
        content: 'who are you'
      }
    ],
    stream: false,
    max_tokens: 5
  }

  // 将 JSON 转换为单行字符串，用于 curl 命令
  const payloadStr = JSON.stringify(payload).replace(/'/g, "'\\''")

  return `curl ${url} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${model.apiKey || 'YOUR_API_KEY'}" \\
  -d '${payloadStr}'`
}

async function performTest(model: ModelConfig) {
  try {
    testLoading.value = true
    testResponse.value = null
    testSuccess.value = null

    // 构建后端测试 API 请求信息
    const apiBase = '/api'
    const backendUrl = `${apiBase}/models/${model.id}/test`
    testRequest.value = {
      backend: {
        method: 'POST',
        url: backendUrl,
        headers: {
          'Content-Type': 'application/json'
        },
        body: null
      }
    }

    // 生成 curl 命令
    curlCommand.value = generateCurlCommand(model)

    const result = await testModel(model.id)
    testResponse.value = result
    testSuccess.value = !!result.ok
  } catch (error) {
    console.error('Failed to test model:', error)
    const errorMessage = (error as Error)?.message || '测试失败'
    testResponse.value = { ok: false, message: errorMessage }
    testSuccess.value = false
  } finally {
    testLoading.value = false
  }
}

async function handleTest(model: ModelConfig) {
  testingId.value = model.id
  testingModel.value = model
  showTestDialog.value = true
  await performTest(model)
  testingId.value = null
}

async function retryTest() {
  if (!testingModel.value) return
  testingId.value = testingModel.value.id
  await performTest(testingModel.value)
  testingId.value = null
}


onMounted(() => {
  loadModels()
})
</script>

