<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">APP 监控</h2>
      <p class="text-sm text-muted-foreground">应用请求统计监控</p>
    </div>

    <!-- 时间范围选择 -->
    <Card class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">请求统计</h3>
        <div class="flex items-center gap-2">
          <Select v-model="selectedAppId">
            <SelectTrigger class="w-[200px]">
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
          <Select v-model="selectedPeriod">
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24小时</SelectItem>
              <SelectItem value="7d">7天</SelectItem>
              <SelectItem value="30d">30天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div v-if="loading" class="text-center py-8 text-muted-foreground">
        加载中...
      </div>
      <div v-else-if="apps.length === 0" class="text-center py-8 text-muted-foreground">
        暂无应用数据
      </div>
      <div v-else-if="!selectedAppId" class="text-center py-8 text-muted-foreground">
        请选择一个应用查看统计
      </div>
      <div v-else class="space-y-6">
        <!-- 统计卡片 -->
        <Card class="p-4">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="font-semibold text-sm">{{ selectedApp?.name }}</h4>
              <span class="text-xs text-muted-foreground font-mono">{{ getRequestCount(selectedAppId) }}</span>
            </div>
            <p class="text-xs text-muted-foreground">请求次数</p>
          </div>
        </Card>

        <!-- 折线图 -->
        <Card class="p-6">
          <h3 class="text-lg font-semibold mb-4">请求趋势</h3>
          <ChartContainer :config="chartConfig" class="min-h-[400px] w-full">
            <VisXYContainer :data="chartData">
              <VisLine
                :x="(d: ChartDataPoint) => d.date"
                :y="(d: ChartDataPoint) => d.value || 0"
                :color="getLineColor(0)"
                :stroke-width="2"
              />
              <VisAxis
                type="x"
                :x="(d: ChartDataPoint) => d.date"
                :tick-line="false"
                :domain-line="false"
                :grid-line="false"
                :tick-format="formatXAxisLabel"
                :tick-values="chartData.map(d => d.date)"
              />
              <VisAxis
                type="y"
                :tick-format="(d: number) => d.toString()"
                :tick-line="false"
                :domain-line="false"
                :grid-line="true"
              />
              <ChartTooltip />
              <ChartCrosshair
                :template="componentToString(chartConfig, ChartTooltipContent, {
                  formatLabel: formatXAxisLabel,
                })"
                :color="[getLineColor(0)]"
              />
            </VisXYContainer>
            <ChartLegendContent />
          </ChartContainer>
        </Card>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { VisLine, VisXYContainer, VisAxis } from '@unovis/vue'
import { fetchApps, fetchRequestStats, type RequestStats } from '@/lib/api'
import type { App } from '@/types'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartCrosshair,
  ChartLegendContent,
  componentToString,
  type ChartConfig,
} from '@/components/ui/chart'

interface ChartDataPoint {
  date: Date
  value: number
}

const apps = ref<App[]>([])
const stats = ref<Record<string, RequestStats>>({})
const loading = ref(false)
const selectedAppId = ref<string>('')
const selectedPeriod = ref<'24h' | '7d' | '30d'>('24h')

// 当前选中的应用
const selectedApp = computed(() => {
  return apps.value.find(app => app.id === selectedAppId.value)
})

const chartData = computed<ChartDataPoint[]>(() => {
  if (!selectedAppId.value) return []
  const stat = stats.value[selectedAppId.value]
  if (!stat) return []

  const timeline =
    selectedPeriod.value === '24h'
      ? stat.timeline24h
      : selectedPeriod.value === '7d'
        ? stat.timeline7d
        : stat.timeline30d

  if (!timeline || timeline.length === 0) {
    return []
  }

  return timeline.map(point => ({
    date: new Date(point.timestamp),
    value: point.value
  }))
})

// 图表配置
const chartConfig = computed<ChartConfig>(() => {
  if (!selectedApp.value) return {}
  return {
    [selectedAppId.value]: {
      label: selectedApp.value.name,
      color: getLineColor(0),
    }
  }
})

// 格式化X轴标签
function formatXAxisLabel(d: number | Date | string): string {
  // 处理不同类型的输入
  let date: Date
  if (typeof d === 'number') {
    date = new Date(d)
  } else if (typeof d === 'string') {
    date = new Date(d)
  } else {
    date = d
  }

  // 检查日期是否有效
  if (isNaN(date.getTime())) {
    return String(d)
  }

  if (selectedPeriod.value === '24h') {
    return `${date.getHours().toString().padStart(2, '0')}:00`
  } else if (selectedPeriod.value === '7d') {
    return `${date.getMonth() + 1}/${date.getDate()}`
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
}

// 获取线条颜色
function getLineColor(index: number): string {
  const colors = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ]
  return colors[index % colors.length]
}

// 获取请求次数
function getRequestCount(appId: string): number {
  const stat = stats.value[appId]
  if (!stat) return 0
  const count = (() => {
    switch (selectedPeriod.value) {
      case '24h':
        return stat.count24h
      case '7d':
        return stat.count7d
      case '30d':
        return stat.count30d
      default:
        return 0
    }
  })()
  return count
}

async function loadData() {
  loading.value = true
  try {
    apps.value = await fetchApps()
    if (apps.value.length > 0) {
      // 默认选择第一个应用
      if (!selectedAppId.value) {
        selectedAppId.value = apps.value[0].id
      }
      const appIds = apps.value.map(app => app.id)
      stats.value = await fetchRequestStats(appIds)
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>
