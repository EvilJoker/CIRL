<template>
  <span
    :class="
      cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variantClasses[variant] || variantClasses.default,
        props.class
      )
    "
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  class?: string
}>()

const variantClasses = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  destructive: 'border-transparent bg-destructive text-destructive-foreground',
  outline: 'text-foreground'
} as const

const variant = props.variant || 'default'
</script>

