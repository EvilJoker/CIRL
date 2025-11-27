<script setup lang="ts">
import { VisCrosshair } from '@unovis/vue'
import type { Component } from 'vue'

type TemplateFn = (data: any, x: number | Date) => string

const props = defineProps<{
  template?: Component | string | TemplateFn
  color?: string | string[]
}>()
</script>

<template>
  <VisCrosshair
    v-if="props.template"
    :template="props.template"
    :color="props.color"
  />
</template>

