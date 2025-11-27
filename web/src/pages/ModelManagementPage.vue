<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">模型管理</h2>
      <p class="text-sm text-muted-foreground">
        配置命中分析等功能可复用的 OpenAI 兼容模型
      </p>
    </div>

    <Card class="p-6 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold">模型列表</h3>
          <p class="text-sm text-muted-foreground">
            支持多个模型配置，分析时可按需选择
          </p>
        </div>
        <Button @click="openDialog()">新建模型</Button>
      </div>

      <div v-if="loading" class="text-sm text-muted-foreground">加载中...</div>
      <div v-else-if="models.length === 0" class="text-sm text-muted-foreground">
        暂无模型，请先创建配置。
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="model in models"
          :key="model.id"
          class="p-4 border rounded-lg flex flex-wrap justify-between gap-3 text-sm"
        >
          <div>
            <p class="font-medium">{{ model.name }}</p>
            <p class="text-xs text-muted-foreground">
              {{ model.model }} · {{ model.provider }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ model.baseUrl }}
            </p>
            <p class="text-xs text-muted-foreground">
              创建：{{ formatDate(model.createdAt) }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" @click="openDialog(model)">编辑</Button>
            <Button size="sm" variant="destructive" @click="removeModel(model)">删除</Button>
          </div>
        </div>
      </div>
    </Card>

    <Dialog :open="showDialog" @update:open="showDialog = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingModel ? '编辑模型' : '新建模型' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">名称</label>
            <Input v-model="form.name" placeholder="如：OpenAI 默认模型" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">模型 ID</label>
            <Input v-model="form.model" placeholder="如：gpt-4o-mini" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Base URL</label>
            <Input v-model="form.baseUrl" placeholder="https://api.openai.com/v1" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">API Key</label>
            <Input v-model="form.apiKey" type="password" placeholder="sk-..." />
          </div>
        </div>
        <DialogFooter class="gap-2">
          <Button variant="outline" @click="showDialog = false">取消</Button>
          <Button @click="saveModel" :disabled="!form.name || !form.model">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { fetchModels, createModel, updateModel, deleteModel } from '@/lib/api'
import type { ModelConfig } from '@/types'

const models = ref<ModelConfig[]>([])
const loading = ref(false)
const showDialog = ref(false)
const editingModel = ref<ModelConfig | null>(null)
const form = ref({
  name: '',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: ''
})

async function loadModels() {
  loading.value = true
  try {
    models.value = await fetchModels()
  } catch (error) {
    console.error('Failed to load models:', error)
    alert('加载失败')
  } finally {
    loading.value = false
  }
}

function openDialog(model?: ModelConfig) {
  editingModel.value = model ?? null
  form.value = {
    name: model?.name ?? '',
    provider: model?.provider ?? 'openai',
    baseUrl: model?.baseUrl ?? 'https://api.openai.com/v1',
    apiKey: model?.apiKey ?? '',
    model: model?.model ?? ''
  }
  showDialog.value = true
}

async function saveModel() {
  try {
    if (editingModel.value) {
      await updateModel(editingModel.value.id, form.value)
    } else {
      await createModel(form.value)
    }
    showDialog.value = false
    await loadModels()
  } catch (error) {
    console.error('Failed to save model:', error)
    alert('保存失败')
  }
}

async function removeModel(model: ModelConfig) {
  if (!confirm(`确定删除模型「${model.name}」吗？`)) return
  try {
    await deleteModel(model.id)
    await loadModels()
  } catch (error) {
    console.error('Failed to delete model:', error)
    alert('删除失败')
  }
}

onMounted(() => {
  loadModels()
})
</script>

