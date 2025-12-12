import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// helper for TanStack Table state updates
export function valueUpdater<T>(updaterOrValue: T | ((old: T) => T), currentValue: T): T {
  return typeof updaterOrValue === 'function'
    ? (updaterOrValue as (old: T) => T)(currentValue)
    : updaterOrValue
}

