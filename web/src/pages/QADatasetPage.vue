<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">QA 数据集管理</h2>
      <p class="text-sm text-muted-foreground">
        管理数据集并查看命中情况，辅助 QA 迭代
      </p>
    </div>

    <Card class="p-6 space-y-4">
      <div class="text-sm text-muted-foreground">
        已创建 {{ datasets.length }} 个数据集
      </div>

      <div v-if="datasets.length === 0" class="text-center py-8 text-muted-foreground">
        暂无数据集
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2">
        <div
          v-for="dataset in datasets"
          :key="dataset.id"
          class="border rounded-lg p-4 space-y-3"
        >
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-semibold">{{ dataset.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ dataset.description || '—' }}</p>
            </div>
            <Badge>{{ dataset.queryRecordIds.length }} 条 QA</Badge>
          </div>
          <div class="text-xs text-muted-foreground">
            最近更新：{{ formatDate(dataset.updatedAt) }}
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="p-2 border rounded">
              <p class="text-muted-foreground text-xs">完全命中</p>
              <p class="text-lg font-semibold">{{ getDatasetStats(dataset.id).exact }}</p>
            </div>
            <div class="p-2 border rounded">
              <p class="text-muted-foreground text-xs">80% 命中</p>
              <p class="text-lg font-semibold">{{ getDatasetStats(dataset.id).high }}</p>
            </div>
            <div class="p-2 border rounded">
              <p class="text-muted-foreground text-xs">60% 命中</p>
              <p class="text-lg font-semibold">{{ getDatasetStats(dataset.id).medium }}</p>
            </div>
            <div class="p-2 border rounded">
              <p class="text-muted-foreground text-xs">未命中</p>
              <p class="text-lg font-semibold">{{ getDatasetStats(dataset.id).none }}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fetchDatasets, fetchHitAnalyses } from '@/lib/api'
import type { Dataset, HitAnalysis } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const datasets = ref<Dataset[]>([])
const hitAnalyses = ref<HitAnalysis[]>([])

const datasetHitMap = computed(() => {
  const map: Record<string, { exact: number; high: number; medium: number; none: number }> = {}
  hitAnalyses.value.forEach(analysis => {
    if (!map[analysis.datasetId]) {
      map[analysis.datasetId] = { exact: 0, high: 0, medium: 0, none: 0 }
    }
    map[analysis.datasetId][analysis.matchType] += 1
  })
  return map
})

function getDatasetStats(datasetId: string) {
  return datasetHitMap.value[datasetId] || { exact: 0, high: 0, medium: 0, none: 0 }
}

async function loadDatasets() {
  try {
    datasets.value = await fetchDatasets()
  } catch (error) {
    console.error('Failed to load datasets:', error)
  }
}

async function loadHitAnalyses() {
  try {
    hitAnalyses.value = await fetchHitAnalyses()
  } catch (error) {
    console.error('Failed to load hit analyses:', error)
  }
}

onMounted(async () => {
  await Promise.all([loadDatasets(), loadHitAnalyses()])
})
</script>

