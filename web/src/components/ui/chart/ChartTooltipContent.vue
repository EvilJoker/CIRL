<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  payload?: Array<{
    name?: string
    value?: number | string
    color?: string
  }>
  label?: string | number | Date
  formatLabel?: (value: string | number | Date) => string
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: 'dot' | 'line' | 'dashed'
}>()

const formattedLabel = computed(() => {
  if (props.hideLabel) return ''
  if (props.label === undefined || props.label === null) return ''

  if (props.formatLabel) {
    return props.formatLabel(props.label)
  }

  if (props.label instanceof Date) {
    return props.label.toISOString()
  }

  if (typeof props.label === 'number') {
    return props.label.toString()
  }

  return props.label
})

const items = computed(() => {
  if (!props.payload || !Array.isArray(props.payload)) {
    return []
  }

  return props.payload.map(item => ({
    name: item.name ?? '请求次数',
    value: typeof item.value === 'number' ? item.value : Number(item.value) || 0,
    color: item.color ?? 'var(--chart-1)'
  }))
})
</script>

<template>
  <div
    v-if="items.length > 0"
    class="rounded-lg border bg-popover p-2 text-popover-foreground shadow-md"
  >
    <div v-if="formattedLabel" class="mb-2 text-sm font-medium">
      {{ formattedLabel }}
    </div>
    <div class="space-y-1">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center gap-2 text-sm"
      >
        <div
          v-if="!hideIndicator"
          :class="cn(
            'h-2.5 w-2.5 rounded-full',
            indicator === 'line' && 'h-0.5 w-4',
            indicator === 'dashed' && 'h-0.5 w-4 border-t-2 border-dashed'
          )"
          :style="{ backgroundColor: item.color }"
        />
        <span class="text-muted-foreground">{{ item.name }}:</span>
        <span class="font-medium">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>

