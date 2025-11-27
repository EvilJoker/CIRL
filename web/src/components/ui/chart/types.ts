import type { Component } from 'vue'

export type ChartConfig = Record<
  string,
  {
    label?: string
    icon?: Component
    color?: string
    theme?: {
      light: string
      dark: string
    }
  }
>

