<script setup lang="ts">
import type { ChartConfig } from './types'
import { provide, type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  config: ChartConfig
  class?: HTMLAttributes['class']
}>()

provide('chartConfig', props.config)
</script>

<template>
  <div :class="cn('w-full', props.class)">
    <slot />
  </div>
</template>

