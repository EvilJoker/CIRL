<script setup lang="ts">
import type { ChartConfig } from './types'
import { inject, computed } from 'vue'

const props = defineProps<{
  nameKey?: string
  data?: any[]
}>()

const chartConfig = inject<ChartConfig>('chartConfig', {})

const items = computed(() => {
  // 如果提供了 nameKey，使用它
  if (props.nameKey && props.data && Array.isArray(props.data)) {
    const keys = new Set<string>()
    props.data.forEach((item) => {
      if (item[props.nameKey!]) {
        keys.add(item[props.nameKey!])
      }
    })
    return Array.from(keys).map((key) => {
      const config = chartConfig[key]
      return {
        name: config?.label || key,
        color: config?.color || 'var(--chart-1)',
        icon: config?.icon,
      }
    })
  }

  // 否则从 chartConfig 中获取所有键
  return Object.keys(chartConfig).map((key) => {
    const config = chartConfig[key]
    return {
      name: config?.label || key,
      color: config?.color || 'var(--chart-1)',
      icon: config?.icon,
    }
  })
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="flex items-center gap-2 text-sm"
    >
      <component
        v-if="item.icon"
        :is="item.icon"
        class="h-4 w-4"
        :style="{ color: item.color }"
      />
      <div
        v-else
        class="h-2.5 w-2.5 rounded-full"
        :style="{ backgroundColor: item.color }"
      />
      <span class="text-muted-foreground">{{ item.name }}</span>
    </div>
  </div>
</template>

