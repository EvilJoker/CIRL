import type { Component } from 'vue'
import { h, render, useId } from 'vue'
import { isClient } from '@vueuse/core'
import type { ChartConfig } from './types'

const cache = new Map<string, string>()

function serializeKey(key: Record<string, any>) {
  return JSON.stringify(key, Object.keys(key).sort())
}

interface Constructor<P = any> {
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never
  new (...args: any[]): {
    $props: P
  }
}

export function componentToString<P>(
  config: ChartConfig,
  component: Constructor<P>,
  props?: P
) {
  if (!isClient) {
    return undefined
  }

  const id = useId()

  return (_data: any, x: number | Date) => {
    const data = 'data' in _data ? _data.data : _data
    const serializedKey = `${id}-${serializeKey(data)}-${x instanceof Date ? x.toISOString() : x}`
    const cachedContent = cache.get(serializedKey)

    if (cachedContent) {
      return cachedContent
    }

    const payloadArray: Array<{ name?: string; value?: number | string; color?: string }> =
      Array.isArray(data)
        ? data
        : (() => {
            const configEntries = Object.entries(config)
            if (configEntries.length === 0) {
              return [
                {
                  name: '请求次数',
                  value: typeof data === 'object' && data !== null ? data.value ?? data.y ?? 0 : data ?? 0,
                  color: 'var(--chart-1)'
                }
              ]
            }

            return configEntries.map(([key, cfg]) => ({
              name: cfg?.label ?? key,
              value:
                typeof data === 'object' && data !== null
                  ? data.value ?? data[key] ?? data.y ?? 0
                  : data ?? 0,
              color: cfg?.color ?? 'var(--chart-1)'
            }))
          })()

    const vnode = h(component as unknown as Component, {
      ...props,
      payload: payloadArray,
      config,
      x,
      label: x
    })

    const div = document.createElement('div')
    render(vnode, div)
    const html = div.innerHTML
    cache.set(serializedKey, html)

    return html
  }
}

