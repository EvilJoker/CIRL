<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">APP 管理</h2>
      <p class="text-sm text-muted-foreground">创建和管理应用</p>
    </div>

    <Card class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">应用列表</h3>
        <Button @click="showCreateModal = true">
          创建应用
        </Button>
      </div>

      <div v-if="loading" class="text-center py-8 text-muted-foreground">
        加载中...
      </div>
      <div v-else-if="apps.length === 0" class="text-center py-8 text-muted-foreground">
        暂无应用，点击"创建应用"开始
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="app in apps"
          :key="app.id"
          class="p-4 border rounded-lg hover:bg-muted/50"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h4 class="font-semibold">{{ app.name }}</h4>
                <span class="text-xs text-muted-foreground font-mono">ID: {{ app.id }}</span>
              </div>
              <p v-if="app.description" class="text-sm text-muted-foreground mt-1">
                {{ app.description }}
              </p>
              <p class="text-xs text-muted-foreground mt-2">
                创建时间: {{ formatDate(app.createdAt) }}
              </p>
            </div>
            <div class="flex gap-2">
              <Button size="sm" variant="outline" @click="editApp(app)">
                编辑
              </Button>
              <Button size="sm" variant="destructive" @click="deleteApp(app.id)">
                删除
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- 创建/编辑对话框 -->
    <Dialog :open="showCreateModal || !!editingApp" @update:open="handleDialogClose">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingApp ? '编辑应用' : '创建应用' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">名称</label>
            <Input v-model="formData.name" placeholder="输入应用名称" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">描述</label>
            <Textarea v-model="formData.description" placeholder="输入描述（可选）" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="handleDialogClose">取消</Button>
          <Button @click="handleSave">{{ editingApp ? '保存' : '创建' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchApps, createApp, updateApp, deleteApp as deleteAppApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { App } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const apps = ref<App[]>([])
const loading = ref(false)
const showCreateModal = ref(false)
const editingApp = ref<App | null>(null)
const formData = ref({ name: '', description: '' })

async function loadApps() {
  loading.value = true
  try {
    apps.value = await fetchApps()
  } catch (error) {
    console.error('Failed to load apps:', error)
  } finally {
    loading.value = false
  }
}

function editApp(app: App) {
  editingApp.value = app
  formData.value = { name: app.name, description: app.description || '' }
}

async function handleSave() {
  if (!formData.value.name.trim()) return

  try {
    if (editingApp.value) {
      await updateApp(editingApp.value.id, formData.value)
    } else {
      await createApp(formData.value)
    }
    handleDialogClose()
    loadApps()
  } catch (error) {
    console.error('Failed to save app:', error)
    alert('保存失败')
  }
}

async function deleteApp(id: string) {
  if (!confirm('确定要删除这个应用吗？')) return
  try {
    await deleteAppApi(id)
    loadApps()
  } catch (error) {
    console.error('Failed to delete app:', error)
    alert('删除失败')
  }
}

function handleDialogClose() {
  showCreateModal.value = false
  editingApp.value = null
  formData.value = { name: '', description: '' }
}

onMounted(() => {
  loadApps()
})
</script>

