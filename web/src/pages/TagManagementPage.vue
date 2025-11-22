<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Tag 管理</h2>
      <p class="text-sm text-muted-foreground">
        查看所有标签及其覆盖的 QA 数量，帮助识别高频领域
      </p>
    </div>

    <Card class="p-6 space-y-4">
      <div class="text-sm text-muted-foreground">
        共 {{ tagStats.length }} 个标签
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <div
          v-for="tag in tagStats"
          :key="tag.name"
          class="p-4 border rounded-lg space-y-2"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">#{{ tag.name }}</h3>
            <Badge>{{ tag.count }} 条 QA</Badge>
          </div>
          <p class="text-xs text-muted-foreground">
            最近命中：{{ tag.lastAnalyzed ? formatDate(tag.lastAnalyzed) : '—' }}
          </p>
          <div class="text-xs text-muted-foreground">
            包含应用：{{ tag.apps.join(', ') || '—' }}
          </div>
        </div>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchQueryRecords, fetchApps } from '@/lib/api'
import type { App } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const tagStats = ref<Array<{ name: string; count: number; apps: string[]; lastAnalyzed?: string }>>([])

onMounted(async () => {
  const [recordsResponse, apps] = await Promise.all([fetchQueryRecords({ pageSize: 500 }), fetchApps()])
  const appMap = new Map<string, App>()
  apps.forEach(app => appMap.set(app.id, app))
  const statsMap = new Map<string, { count: number; apps: Set<string>; lastAnalyzed?: string }>()
  recordsResponse.data.forEach(record => {
    record.tags?.forEach(tag => {
      if (!statsMap.has(tag)) {
        statsMap.set(tag, { count: 0, apps: new Set(), lastAnalyzed: undefined })
      }
      const entry = statsMap.get(tag)!
      entry.count += 1
      const appName = appMap.get(record.appId)?.name || record.appId
      entry.apps.add(appName)
      if (record.metadata?.lastAnalyzedAt) {
        if (!entry.lastAnalyzed || new Date(record.metadata.lastAnalyzedAt) > new Date(entry.lastAnalyzed)) {
          entry.lastAnalyzed = record.metadata.lastAnalyzedAt
        }
      }
    })
  })
  tagStats.value = Array.from(statsMap.entries())
    .map(([name, value]) => ({
      name,
      count: value.count,
      apps: Array.from(value.apps),
      lastAnalyzed: value.lastAnalyzed
    }))
    .sort((a, b) => b.count - a.count)
})
</script>

