<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="hidden h-8 ml-auto lg:flex"
      >
        <MixerHorizontalIcon class="w-4 h-4 mr-2" />
        显示列
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-[180px]">
      <div class="space-y-2">
        <p class="text-sm font-medium">切换列</p>
        <div class="space-y-1">
          <label
            v-for="column in columns"
            :key="column.id"
            class="flex items-center gap-2 text-sm capitalize cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="column.getIsVisible()"
              @change="column.toggleVisibility(($event.target as HTMLInputElement).checked)"
              class="rounded"
            />
            {{ column.id }}
          </label>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'
import { Settings } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const MixerHorizontalIcon = Settings

interface DataTableViewOptionsProps {
  table: Table<any>
}

const props = defineProps<DataTableViewOptionsProps>()

const columns = computed(() =>
  props.table
    .getAllColumns()
    .filter(column => typeof column.accessorFn !== 'undefined' && column.getCanHide())
)
</script>

