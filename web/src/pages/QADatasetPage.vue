<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">QA 数据集管理</h2>
      <p class="text-sm text-muted-foreground">
        管理数据集并查看命中情况，辅助 QA 迭代
      </p>
    </div>

    <Card class="p-6 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-muted-foreground">
          已创建 {{ datasets.length }} 个数据集
        </div>
        <Button @click="openCreateDialog">新建数据集</Button>
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
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="font-semibold">{{ dataset.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ dataset.description || '—' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <Badge>{{ dataset.queryRecordIds.length }} 条 QA</Badge>
              <Button size="sm" variant="destructive" @click="handleDelete(dataset)">
                删除
              </Button>
            </div>
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

    <Dialog :open="showCreateDialog" @update:open="showCreateDialog = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建数据集</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">应用</label>
            <Select v-model="form.appId">
              <SelectTrigger>
                <SelectValue placeholder="选择应用" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="app in apps"
                  :key="app.id"
                  :value="app.id"
                >
                  {{ app.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">名称</label>
            <Input v-model="form.name" placeholder="如：FAQ 精选集" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">描述</label>
            <Textarea v-model="form.description" placeholder="可选" rows="3" />
          </div>
        </div>
        <DialogFooter class="gap-2">
          <Button variant="outline" @click="showCreateDialog = false">取消</Button>
          <Button
            @click="createDataset"
            :disabled="!form.appId || !form.name || saving"
          >
            {{ saving ? '创建中...' : '创建' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  fetchApps,
  fetchDatasets,
  fetchHitAnalyses,
  createDataset as createDatasetApi,
  deleteDataset as deleteDatasetApi
} from '@/lib/api'
import type { App, Dataset, HitAnalysis } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const apps = ref<App[]>([])
const datasets = ref<Dataset[]>([])
const hitAnalyses = ref<HitAnalysis[]>([])
const showCreateDialog = ref(false)
const saving = ref(false)
const form = ref({
  appId: '',
  name: '',
  description: ''
})

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

async function loadApps() {
  try {
    apps.value = await fetchApps()
    if (!form.value.appId && apps.value.length > 0) {
      form.value.appId = apps.value[0].id
    }
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

function openCreateDialog() {
  if (!form.value.appId && apps.value.length > 0) {
    form.value.appId = apps.value[0].id
  }
  showCreateDialog.value = true
}

async function createDataset() {
  if (!form.value.appId || !form.value.name) return
  saving.value = true
  try {
    await createDatasetApi({
      appId: form.value.appId,
      name: form.value.name,
      description: form.value.description,
      queryRecordIds: []
    })
    showCreateDialog.value = false
    form.value = { appId: form.value.appId, name: '', description: '' }
    await loadDatasets()
  } catch (error) {
    console.error('Failed to create dataset:', error)
    alert('创建失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(dataset: Dataset) {
  if (!confirm(`确认删除数据集「${dataset.name}」吗？`)) return
  try {
    await deleteDatasetApi(dataset.id)
    await loadDatasets()
  } catch (error) {
    console.error('Failed to delete dataset:', error)
    alert('删除失败')
  }
}

onMounted(async () => {
  await Promise.all([loadApps(), loadDatasets(), loadHitAnalyses()])
})
</script>

