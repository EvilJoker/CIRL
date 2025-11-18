<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">数据集管理</h2>
      <p class="text-sm text-muted-foreground">创建和管理数据集（标准答案集）</p>
    </div>

    <Card class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">数据集列表</h3>
        <Button @click="showCreateModal = true">
          创建数据集
        </Button>
      </div>

      <div v-if="loading" class="text-center py-8 text-muted-foreground">
        加载中...
      </div>
      <div v-else-if="datasets.length === 0" class="text-center py-8 text-muted-foreground">
        暂无数据集
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="dataset in datasets"
          :key="dataset.id"
          class="p-4 border rounded-lg hover:bg-muted/50"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h4 class="font-semibold">{{ dataset.name }}</h4>
              <p v-if="dataset.description" class="text-sm text-muted-foreground mt-1">
                {{ dataset.description }}
              </p>
              <p class="text-xs text-muted-foreground mt-2">
                包含 {{ dataset.queryRecordIds.length }} 条问答记录
              </p>
            </div>
            <Button size="sm" variant="destructive" @click="deleteDataset(dataset.id)">
              删除
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- 创建数据集对话框 -->
    <Dialog :open="showCreateModal" @update:open="showCreateModal = $event">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>创建数据集</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">应用</label>
            <Select v-model="createForm.appId">
              <SelectTrigger>
                <SelectValue placeholder="选择应用" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="app in apps" :key="app.id" :value="app.id">
                  {{ app.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">名称</label>
            <Input v-model="createForm.name" placeholder="数据集名称" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">描述</label>
            <Textarea v-model="createForm.description" placeholder="描述（可选）" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">选择问答记录</label>
            <p class="text-xs text-muted-foreground mb-2">
              已选择 {{ selectedRecordIds.length }} 条记录
            </p>
            <div class="border rounded-lg p-4 max-h-[300px] overflow-auto">
              <div v-if="availableRecords.length === 0" class="text-sm text-muted-foreground">
                暂无可用记录
              </div>
              <div v-else class="space-y-2">
                <label
                  v-for="record in availableRecords"
                  :key="record.id"
                  class="flex items-start gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :value="record.id"
                    v-model="selectedRecordIds"
                    class="mt-1"
                  />
                  <div class="flex-1">
                    <p class="text-sm">{{ record.input }}</p>
                    <p class="text-xs text-muted-foreground mt-1">{{ record.output.substring(0, 50) }}...</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateModal = false">取消</Button>
          <Button @click="handleCreate">创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { fetchApps, fetchDatasets, createDataset, deleteDataset as deleteDatasetApi, fetchQueryRecords } from '@/lib/api'
import type { App, Dataset, QueryRecord } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const apps = ref<App[]>([])
const datasets = ref<Dataset[]>([])
const availableRecords = ref<QueryRecord[]>([])
const loading = ref(false)
const showCreateModal = ref(false)
const createForm = ref({ appId: '', name: '', description: '' })
const selectedRecordIds = ref<string[]>([])

async function loadApps() {
  try {
    apps.value = await fetchApps()
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

async function loadDatasets() {
  loading.value = true
  try {
    datasets.value = await fetchDatasets()
  } catch (error) {
    console.error('Failed to load datasets:', error)
  } finally {
    loading.value = false
  }
}

async function loadRecords() {
  if (!createForm.value.appId) return
  try {
    const result = await fetchQueryRecords({ appId: createForm.value.appId })
    availableRecords.value = result.data
  } catch (error) {
    console.error('Failed to load records:', error)
  }
}

watch(() => createForm.value.appId, () => {
  loadRecords()
  selectedRecordIds.value = []
})

async function handleCreate() {
  if (!createForm.value.appId || !createForm.value.name || selectedRecordIds.value.length === 0) {
    alert('请填写完整信息并选择至少一条记录')
    return
  }
  try {
    await createDataset({
      appId: createForm.value.appId,
      name: createForm.value.name,
      description: createForm.value.description,
      queryRecordIds: selectedRecordIds.value
    })
    showCreateModal.value = false
    createForm.value = { appId: '', name: '', description: '' }
    selectedRecordIds.value = []
    loadDatasets()
  } catch (error) {
    console.error('Failed to create dataset:', error)
    alert('创建失败')
  }
}

async function deleteDataset(id: string) {
  if (!confirm('确定要删除这个数据集吗？')) return
  try {
    await deleteDatasetApi(id)
    loadDatasets()
  } catch (error) {
    console.error('Failed to delete dataset:', error)
    alert('删除失败')
  }
}

onMounted(() => {
  loadApps()
  loadDatasets()
})
</script>

