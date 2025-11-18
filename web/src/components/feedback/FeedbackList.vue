<template>
  <div>
    <div v-if="loading" class="text-center py-8 text-muted-foreground">
      加载中...
    </div>
    <div v-else-if="feedbacks.length === 0" class="text-center py-8 text-muted-foreground">
      暂无反馈
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="feedback in feedbacks"
        :key="feedback.id"
        class="p-4 border rounded-lg hover:bg-muted/50"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <span
                :class="[
                  'px-2 py-1 text-xs rounded',
                  feedback.type === 'positive' ? 'bg-green-100 text-green-800' :
                  feedback.type === 'negative' ? 'bg-red-100 text-red-800' :
                  feedback.type === 'correction' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                ]"
              >
                {{ feedback.type === 'positive' ? '正面' : feedback.type === 'negative' ? '负面' : feedback.type === 'correction' ? '纠正' : '中性' }}
              </span>
              <span
                :class="[
                  'px-2 py-1 text-xs rounded',
                  feedback.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  feedback.status === 'processed' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                ]"
              >
                {{ feedback.status === 'pending' ? '待处理' : feedback.status === 'processed' ? '已处理' : '已解决' }}
              </span>
            </div>
            <p v-if="feedback.content" class="text-sm mb-2">{{ feedback.content }}</p>
            <p v-if="feedback.rating" class="text-sm text-muted-foreground">评分: {{ feedback.rating }}/5</p>
            <p v-if="feedback.optimizationSuggestion" class="text-sm mt-2 p-2 bg-muted rounded">
              优化建议: {{ feedback.optimizationSuggestion }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              v-if="feedback.status === 'pending'"
              size="sm"
              variant="outline"
              @click="handleProcess(feedback.id)"
            >
              处理
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { fetchFeedbacks, analyzeFeedback } from '@/lib/api'
import type { Feedback } from '@/types'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  status?: string
}>()

const feedbacks = ref<Feedback[]>([])
const loading = ref(false)

async function loadFeedbacks() {
  loading.value = true
  try {
    const params: any = {}
    if (props.status && props.status !== 'all') {
      params.status = props.status
    }
    feedbacks.value = await fetchFeedbacks(params)
  } catch (error) {
    console.error('Failed to load feedbacks:', error)
  } finally {
    loading.value = false
  }
}

async function handleProcess(id: string) {
  try {
    await analyzeFeedback(id)
    await loadFeedbacks()
  } catch (error) {
    console.error('Failed to process feedback:', error)
    alert('处理失败')
  }
}

watch(() => props.status, () => {
  loadFeedbacks()
})

onMounted(() => {
  loadFeedbacks()
})
</script>

