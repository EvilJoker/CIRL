<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <Input
        v-model="globalFilter"
        placeholder="搜索反馈内容"
        class="w-[240px]"
        @keyup.enter="table.setPageIndex(0)"
      />
      <DataTableViewOptions :table="table" />
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
              暂无反馈
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, h } from 'vue'
import type { ColumnDef, SortingState, FilterFn } from '@tanstack/vue-table'
import { FlexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import { fetchFeedbacks, analyzeFeedback } from '@/lib/api'
import type { Feedback } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableColumnHeader, DataTablePagination, DataTableViewOptions } from '@/components/ui/data-table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate } from '@/lib/utils'

const props = defineProps<{
  status?: string
}>()

const feedbacks = ref<Feedback[]>([])
const loading = ref(false)
const globalFilter = ref('')
const sorting = ref<SortingState>([{ id: 'createdAt', desc: true }])

const globalFilterFn: FilterFn<Feedback> = (row, _columnId, filterValue) => {
  const search = String(filterValue || '').toLowerCase()
  if (!search) return true
  const content = String(row.original.content || '').toLowerCase()
  return content.includes(search)
}

const getTypeBadge = (type: Feedback['type']) => {
  const map = {
    positive: { label: '正面', class: 'bg-green-100 text-green-800' },
    negative: { label: '负面', class: 'bg-red-100 text-red-800' },
    correction: { label: '纠正', class: 'bg-yellow-100 text-yellow-800' },
    neutral: { label: '中性', class: 'bg-gray-100 text-gray-800' }
  }
  return map[type] || map.neutral
}

const getStatusBadge = (status: Feedback['status']) => {
  const map = {
    pending: { label: '待处理', class: 'bg-yellow-100 text-yellow-800' },
    processed: { label: '已处理', class: 'bg-blue-100 text-blue-800' },
    resolved: { label: '已解决', class: 'bg-green-100 text-green-800' }
  }
  return map[status] || map.pending
}

const columns = computed<ColumnDef<Feedback>[]>(() => [
  {
    accessorKey: 'type',
    header: '类型',
    cell: ({ row }) => {
      const badge = getTypeBadge(row.getValue('type'))
      return h('span', { class: `px-2 py-1 text-xs rounded ${badge.class}` }, badge.label)
    }
  },
  {
    accessorKey: 'status',
    header: '状态',
    cell: ({ row }) => {
      const badge = getStatusBadge(row.getValue('status'))
      return h('span', { class: `px-2 py-1 text-xs rounded ${badge.class}` }, badge.label)
    }
  },
  {
    accessorKey: 'content',
    header: '反馈内容',
    cell: ({ row }) => row.getValue('content') || '—'
  },
  {
    accessorKey: 'rating',
    header: '评分',
    cell: ({ row }) => {
      const rating = row.getValue('rating')
      return rating ? `${rating}/5` : '—'
    }
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '创建时间' }),
    cell: ({ row }) => formatDate(String(row.getValue('createdAt')))
  },
  {
    id: 'actions',
    header: '操作',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      if (row.original.status === 'pending') {
        return h(Popover, {}, {
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
                  onClick: () => handleProcess(row.original.id)
                }, '处理')
              ])
            ])
          ]
        })
      }
      return '—'
    }
  }
])

const table = useVueTable({
  data: feedbacks,
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

async function loadFeedbacks() {
  loading.value = true
  try {
    const params: any = {}
    if (props.status && props.status !== 'all') {
      params.status = props.status
    }
    feedbacks.value = await fetchFeedbacks(params)
  } catch (error) {
    console.error('Failed to load feedbacks:', error)
  } finally {
    loading.value = false
  }
}

async function handleProcess(id: string) {
  try {
    await analyzeFeedback(id)
    await loadFeedbacks()
  } catch (error) {
    console.error('Failed to process feedback:', error)
    alert('处理失败')
  }
}

watch(() => props.status, () => {
  loadFeedbacks()
})

onMounted(() => {
  loadFeedbacks()
})
</script>

