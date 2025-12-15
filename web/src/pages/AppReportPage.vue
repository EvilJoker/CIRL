<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">APP 报告</h2>
      <p class="text-sm text-muted-foreground">
        参考 QA 跟踪工作台，选择时间范围与模型，一键生成报告任务，完成后点击任务查看 Markdown 报告
      </p>
    </div>

    <Card class="p-5 space-y-4">
      <div class="grid gap-3 md:grid-cols-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label class="text-xs text-muted-foreground">应用</label>
          <Select v-model="selectedAppId">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择应用" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="app in apps" :key="app.id" :value="app.id">
                {{ app.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <label class="text-xs text-muted-foreground">时间范围</label>
          <div class="flex items-center gap-2">
            <Select v-model="selectedRange">
              <SelectTrigger class="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">最近 24 小时</SelectItem>
                <SelectItem value="7d">最近 7 天</SelectItem>
                <SelectItem value="30d">最近 30 天</SelectItem>
                <SelectItem value="custom">自定义</SelectItem>
              </SelectContent>
            </Select>
            <Input v-model="startDate" type="date" class="w-[150px]" />
            <Input v-model="endDate" type="date" class="w-[150px]" />
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-xs text-muted-foreground">生成模型</label>
          <Select v-model="selectedModelId">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="model in models" :key="model.id" :value="model.id">
                {{ model.name }} · {{ model.model }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex items-end">
          <div class="flex flex-wrap gap-2 w-full justify-end">
            <Button variant="outline" :disabled="!canGenerate" @click="loadRecords">
              刷新数据
            </Button>
            <Button variant="secondary" :disabled="!canGenerate" @click="showPromptDialog = true">
              提示词配置
            </Button>
            <Button :disabled="!canGenerate" @click="handleGenerate">
              {{ generating ? '生成中...' : '一键生成报告' }}
            </Button>
          </div>
        </div>
      </div>
      <p v-if="rangeError" class="text-sm text-destructive">{{ rangeError }}</p>
      <div class="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>选定时间：{{ startDate || '未选择' }} ~ {{ endDate || '未选择' }}</span>
        <span>使用模型：{{ selectedModelLabel || '未选择' }}</span>
        <span>QA 数量：{{ totalRecords }}</span>
      </div>
    </Card>

    <Card class="p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">报告任务</h3>
        <div class="flex items-center gap-3">
          <span class="text-xs text-muted-foreground">点击任务查看 Markdown 结果</span>
          <Button variant="outline" size="sm" :disabled="!records.length" @click="exportQA">
            导出 QA 记录
          </Button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[120px]">任务 ID</TableHead>
              <TableHead class="w-[140px]">应用</TableHead>
              <TableHead class="w-[180px]">模型</TableHead>
              <TableHead class="w-[200px]">时间范围</TableHead>
              <TableHead class="w-[120px]">状态</TableHead>
              <TableHead class="w-[160px]">创建时间</TableHead>
              <TableHead class="w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="tasks.length === 0">
              <TableCell :colspan="7" class="h-14 text-center text-muted-foreground">
                暂无任务，点击“一键生成报告”开始。
              </TableCell>
            </TableRow>
            <TableRow v-for="task in tasks" :key="task.id">
              <TableCell class="text-xs text-muted-foreground">{{ task.id }}</TableCell>
              <TableCell class="text-sm font-medium">{{ task.appName }}</TableCell>
              <TableCell class="text-xs text-muted-foreground">{{ task.modelName }}</TableCell>
              <TableCell class="text-xs text-muted-foreground">
                {{ task.startDate }} ~ {{ task.endDate }}
              </TableCell>
              <TableCell>
                <Badge :variant="badgeVariant(task.status)">{{ statusLabel(task.status) }}</Badge>
              </TableCell>
              <TableCell class="text-xs text-muted-foreground">{{ formatDate(task.createdAt) }}</TableCell>
              <TableCell class="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="!task.markdown || task.status !== 'done'"
                  @click="openReport(task)"
                >
                  查看报告
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="!records.length"
                  @click="exportQA"
                >
                  导出 QA 记录
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>

    <Dialog :open="showReportDialog" @update:open="showReportDialog = $event">
      <DialogContent class="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>报告内容</DialogTitle>
          <DialogDescription>任务：{{ activeTask?.id }} · 模型：{{ activeTask?.modelName }}</DialogDescription>
        </DialogHeader>
        <div class="max-h-[65vh] overflow-auto prose max-w-none" v-html="renderedReport" />
        <DialogFooter>
          <Button variant="outline" @click="showReportDialog = false">关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="showPromptDialog" @update:open="showPromptDialog = $event">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>提示词配置</DialogTitle>
          <DialogDescription>配置生成报告的提示词，支持带入当前 QA 记录。</DialogDescription>
        </DialogHeader>
        <div class="space-y-2">
          <label class="text-sm font-medium">提示词</label>
          <textarea
            v-model="promptTemplate"
            class="w-full min-h-[200px] rounded-md border px-3 py-2 text-sm"
            placeholder="请输入用于生成报告的提示词"
          />
          <p class="text-xs text-muted-foreground">生成时会把当前筛选的 QA 记录作为上下文注入。</p>
        </div>
        <DialogFooter class="gap-2">
          <Button variant="outline" @click="showPromptDialog = false">取消</Button>
          <Button @click="showPromptDialog = false">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { marked } from 'marked'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  fetchApps,
  fetchModels,
  fetchQueryRecords,
  fetchReportTasks,
  generateAppReport,
  type ReportTask
} from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { App, ModelConfig, QueryRecord } from '@/types'

type Range = '24h' | '7d' | '30d' | 'custom'
type TaskStatus = 'pending' | 'running' | 'done' | 'failed'

const apps = ref<App[]>([])
const models = ref<ModelConfig[]>([])
const records = ref<QueryRecord[]>([])
const tasks = ref<ReportTask[]>([])
const loadingRecords = ref(false)

const selectedAppId = ref('')
const selectedModelId = ref('')
const selectedRange = ref<Range>('7d')
const startDate = ref(getDateInput(7))
const endDate = ref(getDateInput(0))

const generating = ref(false)
const rangeError = ref('')

const showReportDialog = ref(false)
const activeTask = ref<ReportTask | null>(null)
const showPromptDialog = ref(false)
const promptTemplate = ref(
  '请基于以下 QA 记录生成一份结构化的应用优化报告，包含：高频问题、回答质量评估、改进建议与行动项、模型或知识库优化建议、风险与注意事项。保持条理清晰、可执行。'
)

const selectedModelLabel = computed(() => {
  const model = models.value.find(item => item.id === selectedModelId.value)
  return model ? `${model.name} · ${model.model}` : ''
})

const totalRecords = computed(() => records.value.length)

const canGenerate = computed(() => {
  if (!selectedAppId.value || !selectedModelId.value || generating.value) return false
  if (!startDate.value || !endDate.value || rangeError.value) return false
  return true
})

const renderedReport = computed(() => {
  if (!activeTask.value?.markdown) return ''
  return marked.parse(activeTask.value.markdown)
})

watch(selectedRange, value => {
  if (value === 'custom') return
  const days = value === '24h' ? 1 : value === '7d' ? 7 : 30
  startDate.value = getDateInput(days)
  endDate.value = getDateInput(0)
})

watch([startDate, endDate], () => {
  validateRange()
  loadRecords()
})

watch(selectedAppId, () => {
  loadRecords()
})

async function init() {
  await Promise.all([loadApps(), loadModels(), loadTasks()])
  if (apps.value.length > 0 && !selectedAppId.value) {
    selectedAppId.value = apps.value[0].id
  }
  if (models.value.length > 0 && !selectedModelId.value) {
    selectedModelId.value = models.value[0].id
  }
  await loadRecords()
}

function getDateInput(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function validateRange() {
  rangeError.value = ''
  if (!startDate.value || !endDate.value) return
  const start = new Date(startDate.value)
  const end = new Date(endDate.value)
  if (start > end) {
    rangeError.value = '开始时间不能晚于结束时间'
  }
}

async function loadApps() {
  try {
    apps.value = await fetchApps()
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

async function loadModels() {
  try {
    models.value = await fetchModels()
  } catch (error) {
    console.error('Failed to load models:', error)
  }
}

async function loadTasks() {
  try {
    tasks.value = await fetchReportTasks()
  } catch (error) {
    console.error('Failed to load report tasks:', error)
  }
}

async function loadRecords() {
  if (!selectedAppId.value || !startDate.value || !endDate.value || rangeError.value) {
    records.value = []
    return
  }
  loadingRecords.value = true
  try {
    const res = await fetchQueryRecords({
      appId: selectedAppId.value,
      startDate: startDate.value,
      endDate: endDate.value,
      page: 1,
      pageSize: 200
    })
    records.value = res.data || []
  } catch (error) {
    console.error('Failed to load QA records:', error)
    records.value = []
  } finally {
    loadingRecords.value = false
  }
}

function badgeVariant(status: TaskStatus) {
  switch (status) {
    case 'done':
      return 'default'
    case 'running':
      return 'secondary'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

function statusLabel(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    pending: '待开始',
    running: '进行中',
    done: '已完成',
    failed: '失败'
  }
  return map[status]
}

function getAppName(appId: string) {
  const app = apps.value.find(a => a.id === appId)
  return app?.name || appId
}

function getModelName(modelId: string) {
  const model = models.value.find(m => m.id === modelId)
  return model ? `${model.name} · ${model.model}` : modelId
}

function exportQA() {
  if (!records.value.length) return
  const header = ['id', 'appId', 'question', 'answer', 'modelId', 'createdAt']
  const rows = records.value.map(r => [
    r.id,
    r.appId,
    `"${(r.input || '').replace(/"/g, '""')}"`,
    `"${(r.output || '').replace(/"/g, '""')}"`,
    r.modelId || '',
    r.createdAt || ''
  ])
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `qa_records_${selectedAppId.value || 'all'}_${startDate.value}_${endDate.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleGenerate() {
  if (!canGenerate.value) return
  const nowIso = new Date().toISOString()
  const taskId = `task-${Date.now()}`
  const task: ReportTask = {
    id: taskId,
    appId: selectedAppId.value,
    appName: getAppName(selectedAppId.value),
    modelId: selectedModelId.value,
    modelName: getModelName(selectedModelId.value),
    startDate: startDate.value,
    endDate: endDate.value,
    status: 'running',
    createdAt: nowIso,
    updatedAt: nowIso
  }
  tasks.value = [task, ...tasks.value]
  generating.value = true

  try {
    const res = await generateAppReport({
      taskId,
      appId: task.appId,
      appName: task.appName,
      modelId: task.modelId,
      modelName: task.modelName,
      startDate: task.startDate!,
      endDate: task.endDate!,
      prompt: promptTemplate.value,
      qaRecords: records.value.map(item => ({
        id: item.id,
        question: item.input,
        answer: item.output,
        createdAt: item.createdAt,
        modelId: item.modelId
      }))
    })

    const mergedTask: ReportTask = {
      ...task,
      ...(res.task || {}),
      markdown: res.task?.markdown ?? res.markdown,
      status: res.task?.status || 'done',
      updatedAt: res.task?.updatedAt || new Date().toISOString()
    }
    tasks.value = tasks.value.map(t => (t.id === taskId ? mergedTask : t))
    activeTask.value = mergedTask
    showReportDialog.value = true
  } catch (error) {
    console.error('Failed to generate report:', error)
    task.status = 'failed'
    task.error = '生成失败，请稍后重试'
    tasks.value = tasks.value.map(t => (t.id === taskId ? task : t))
  } finally {
    generating.value = false
    tasks.value = [...tasks.value]
  }
}

function openReport(task: ReportTask) {
  if (!task.markdown) return
  activeTask.value = task
  showReportDialog.value = true
}

onMounted(() => {
  init()
})
</script>

