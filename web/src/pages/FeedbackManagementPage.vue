<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Feedback 管理</h2>
      <p class="text-sm text-muted-foreground">查看和处理用户反馈</p>
    </div>

    <Card class="p-6 space-y-4">
      <div class="flex items-center gap-4">
        <Select v-model="activeStatus">
          <SelectTrigger class="w-[180px]">
            <SelectValue placeholder="选择状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">待处理</SelectItem>
            <SelectItem value="processed">已处理</SelectItem>
            <SelectItem value="resolved">已解决</SelectItem>
            <SelectItem value="all">全部</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FeedbackList :status="activeStatus" />
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Card } from '@/components/ui/card'
import FeedbackList from '@/components/feedback/FeedbackList.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const activeStatus = ref<'pending' | 'processed' | 'resolved' | 'all'>('pending')
</script>

