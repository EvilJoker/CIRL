<template>
  <div v-if="column.getCanSort()" class="flex items-center space-x-2">
    <Button
      variant="ghost"
      size="sm"
      class="-ml-3 h-8"
      @click="column.toggleSorting(column.getIsSorted() === 'asc')"
    >
      <span>{{ title }}</span>
      <ArrowDownIcon v-if="column.getIsSorted() === 'desc'" class="w-4 h-4 ml-2" />
      <ArrowUpIcon v-else-if="column.getIsSorted() === 'asc'" class="w-4 h-4 ml-2" />
      <CaretSortIcon v-else class="w-4 h-4 ml-2" />
    </Button>
  </div>
  <div v-else>
    {{ title }}
  </div>
</template>

<script setup lang="ts">
import type { Column } from '@tanstack/vue-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const ArrowDownIcon = ArrowDown
const ArrowUpIcon = ArrowUp
const CaretSortIcon = ArrowUpDown

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
}

defineProps<DataTableColumnHeaderProps<any, any>>()
</script>

