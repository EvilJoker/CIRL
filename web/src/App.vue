<template>
  <div class="min-h-screen bg-background">
    <AppSidebar>
      <div class="flex h-screen flex-col bg-background">
        <header class="border-b px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-semibold">CIRL Console</h1>
              <p class="text-sm text-muted-foreground">应用优化平台</p>
            </div>
            <Button variant="outline" @click="openApiDocs" class="gap-2">
              <span>📚</span>
              API 文档
            </Button>
          </div>
        </header>

        <main class="flex-1 overflow-auto px-6 py-6">
          <RouterView v-slot="{ Component }">
            <component
              v-if="Component"
              :is="Component"
              :key="route.fullPath"
            />
          </RouterView>
        </main>
      </div>
    </AppSidebar>
  </div>
</template>

<script setup lang="ts">
import { useRoute, RouterView } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'
import { Button } from './components/ui/button'

const route = useRoute()

function openApiDocs() {
  window.open('/api-docs', '_blank')
}
</script>
