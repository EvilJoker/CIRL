<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Tag 管理</h2>
      <p class="text-sm text-muted-foreground">
        查看所有标签及其覆盖的 QA 数量，帮助识别高频领域
      </p>
    </div>

    <Card class="p-6 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-muted-foreground">
          共 {{ tagStats.length }} 个标签
        </div>
        <div class="flex items-center gap-2">
          <Input
            v-model="globalFilter"
            placeholder="搜索标签或应用"
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
              暂无标签
            </TableCell>
          </TableRow>
          <TableRow v-for="row in table.getRowModel().rows" :key="row.id">
            <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <DataTablePagination :table="table" class="pt-2" />
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import type { ColumnDef, SortingState, FilterFn } from '@tanstack/vue-table'
import { FlexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table'
import { fetchQueryRecords, fetchApps } from '@/lib/api'
import type { App } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTablePagination, DataTableViewOptions, DataTableColumnHeader } from '@/components/ui/data-table'

const tagStats = ref<Array<{ name: string; count: number; apps: string[]; lastAnalyzed?: string }>>([])
const sorting = ref<SortingState>([{ id: 'count', desc: true }])
const globalFilter = ref('')

const globalFilterFn: FilterFn<any> = (row, _columnId, filterValue) => {
  const search = String(filterValue || '').toLowerCase()
  if (!search) return true
  const name = String(row.original.name || '').toLowerCase()
  const apps = (row.original.apps || []).join(' ').toLowerCase()
  return name.includes(search) || apps.includes(search)
}

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '标签' }),
    cell: ({ row }) => `#${row.getValue('name')}`
  },
  {
    accessorKey: 'count',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'QA 数量' }),
    cell: ({ row }) => h(Badge, null, () => `${row.getValue('count')} 条`)
  },
  {
    accessorKey: 'apps',
    header: '包含应用',
    cell: ({ row }) => (row.getValue('apps') as string[]).join(', ') || '—'
  },
  {
    accessorKey: 'lastAnalyzed',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: '最近命中' }),
    cell: ({ row }) => {
      const value = row.getValue('lastAnalyzed')
      return value ? formatDate(String(value)) : '—'
    }
  }
]

const table = useVueTable({
  data: tagStats,
  columns: columns,
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

onMounted(async () => {
  const [recordsResponse, apps] = await Promise.all([fetchQueryRecords({ pageSize: 500 }), fetchApps()])
  const appMap = new Map<string, App>()
  apps.forEach(app => appMap.set(app.id, app))
  const statsMap = new Map<string, { count: number; apps: Set<string>; lastAnalyzed?: string }>()
  recordsResponse.data.forEach(record => {
    record.tags?.forEach(tag => {
      if (!statsMap.has(tag)) {
        statsMap.set(tag, { count: 0, apps: new Set(), lastAnalyzed: undefined })
      }
      const entry = statsMap.get(tag)!
      entry.count += 1
      const appName = appMap.get(record.appId)?.name || record.appId
      entry.apps.add(appName)
      if (record.metadata?.lastAnalyzedAt) {
        if (!entry.lastAnalyzed || new Date(record.metadata.lastAnalyzedAt) > new Date(entry.lastAnalyzed)) {
          entry.lastAnalyzed = record.metadata.lastAnalyzedAt
        }
      }
    })
  })
  tagStats.value = Array.from(statsMap.entries())
    .map(([name, value]) => ({
      name,
      count: value.count,
      apps: Array.from(value.apps),
      lastAnalyzed: value.lastAnalyzed
    }))
    .sort((a, b) => b.count - a.count)
})
</script>

