<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">效果评估</h2>
      <p class="text-sm text-muted-foreground">评估应用在数据集上的表现</p>
    </div>

    <Card class="p-6">
      <div class="space-y-4">
        <div class="flex items-center gap-4">
          <Select v-model="evaluationForm.appId">
            <SelectTrigger class="w-[200px]">
              <SelectValue placeholder="选择应用" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="app in apps" :key="app.id" :value="app.id">
                {{ app.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="evaluationForm.datasetId">
            <SelectTrigger class="w-[200px]">
              <SelectValue placeholder="选择数据集" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="dataset in datasets" :key="dataset.id" :value="dataset.id">
                {{ dataset.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="evaluationForm.evaluationType">
            <SelectTrigger class="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="before">优化前</SelectItem>
              <SelectItem value="after">优化后</SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-model="evaluationForm.startDate"
            type="date"
            placeholder="开始日期"
            class="w-[150px]"
          />
          <Input
            v-model="evaluationForm.endDate"
            type="date"
            placeholder="结束日期"
            class="w-[150px]"
          />
          <Button @click="runEvaluation" :disabled="evaluating">
            {{ evaluating ? '评估中...' : '开始评估' }}
          </Button>
        </div>

        <div v-if="evaluation" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 border rounded-lg">
              <p class="text-sm text-muted-foreground">准确率</p>
              <p class="text-2xl font-bold mt-1">{{ evaluation.metrics.accuracy }}%</p>
            </div>
            <div class="p-4 border rounded-lg">
              <p class="text-sm text-muted-foreground">速度</p>
              <p class="text-2xl font-bold mt-1">{{ evaluation.metrics.speed }}ms</p>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-4">
            <div class="p-4 border rounded-lg">
              <p class="text-sm text-muted-foreground">完全命中率</p>
              <p class="text-xl font-bold mt-1">{{ evaluation.metrics.exactHitRate }}%</p>
            </div>
            <div class="p-4 border rounded-lg">
              <p class="text-sm text-muted-foreground">80%相似率</p>
              <p class="text-xl font-bold mt-1">{{ evaluation.metrics.highHitRate }}%</p>
            </div>
            <div class="p-4 border rounded-lg">
              <p class="text-sm text-muted-foreground">60%相似率</p>
              <p class="text-xl font-bold mt-1">{{ evaluation.metrics.mediumHitRate }}%</p>
            </div>
            <div class="p-4 border rounded-lg">
              <p class="text-sm text-muted-foreground">未命中率</p>
              <p class="text-xl font-bold mt-1">{{ evaluation.metrics.noHitRate }}%</p>
            </div>
          </div>
        </div>

        <div v-if="comparison" class="mt-6 p-4 border rounded-lg">
          <h3 class="font-semibold mb-4">优化前后对比</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground mb-2">优化前</p>
              <p>准确率: {{ comparison.before?.metrics.accuracy }}%</p>
              <p>速度: {{ comparison.before?.metrics.speed }}ms</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground mb-2">优化后</p>
              <p>准确率: {{ comparison.after?.metrics.accuracy }}%</p>
              <p>速度: {{ comparison.after?.metrics.speed }}ms</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { fetchApps, fetchDatasets, createEvaluation, compareEvaluations } from '@/lib/api'
import type { App, Dataset, Evaluation } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const apps = ref<App[]>([])
const datasets = ref<Dataset[]>([])
const evaluating = ref(false)
const evaluation = ref<Evaluation | null>(null)
const comparison = ref<{ before?: Evaluation; after?: Evaluation } | null>(null)
const evaluationForm = ref({
  appId: '',
  datasetId: '',
  evaluationType: 'before' as 'before' | 'after',
  startDate: '',
  endDate: ''
})

async function loadApps() {
  try {
    apps.value = await fetchApps()
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

async function loadDatasets() {
  try {
    datasets.value = await fetchDatasets()
  } catch (error) {
    console.error('Failed to load datasets:', error)
  }
}

watch(() => evaluationForm.value.appId, () => {
  loadDatasets()
})

watch(() => [evaluationForm.value.appId, evaluationForm.value.datasetId], () => {
  loadComparison()
})

async function runEvaluation() {
  if (!evaluationForm.value.appId || !evaluationForm.value.datasetId || !evaluationForm.value.startDate || !evaluationForm.value.endDate) {
    alert('请填写完整信息')
    return
  }

  evaluating.value = true
  try {
    evaluation.value = await createEvaluation(evaluationForm.value)
    await loadComparison()
  } catch (error) {
    console.error('Failed to run evaluation:', error)
    alert('评估失败')
  } finally {
    evaluating.value = false
  }
}

async function loadComparison() {
  if (!evaluationForm.value.appId || !evaluationForm.value.datasetId) return
  try {
    comparison.value = await compareEvaluations({
      appId: evaluationForm.value.appId,
      datasetId: evaluationForm.value.datasetId
    })
  } catch (error) {
    console.error('Failed to load comparison:', error)
  }
}

onMounted(() => {
  loadApps()
})
</script>

