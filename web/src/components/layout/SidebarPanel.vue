<template>
  <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" as-child>
          <a href="/">
            <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <span class="text-sm font-semibold">C</span>
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">CIRL Console</span>
              <span class="truncate text-xs text-muted-foreground">应用优化平台</span>
            </div>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarHeader>

  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>导航</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in navItems" :key="item.id">
          <SidebarMenuButton
            :is-active="currentTab === item.id"
            :aria-disabled="false"
            variant="default"
            as-child
          >
            <RouterLink
              class="flex w-full items-center gap-2"
              :to="{ name: item.id as RouteTab }"
            >
              <component :is="item.icon" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  </SidebarContent>

  <SidebarFooter />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  Database,
  LayoutDashboard,
  MessageSquare,
  ClipboardList,
  MessageCircle,
  Tags,
  FileText,
  Settings,
  BarChart3
} from 'lucide-vue-next'

const route = useRoute()

type RouteTab =
  | 'apps'
  | 'dashboard'
  | 'qa-tracking'
  | 'qa-management'
  | 'tag-management'
  | 'app-report'
  | 'model-management'
  | 'evaluation'
  | 'feedbacks'

const currentTab = computed<RouteTab>(() => {
  const name = route.name?.toString()
  return (name as RouteTab) || 'qa-tracking'
})

const navItems = [
  { id: 'apps', label: 'APP 管理', icon: Database },
  { id: 'dashboard', label: 'APP 监控', icon: LayoutDashboard },
  { id: 'qa-tracking', label: 'QA 跟踪', icon: MessageSquare },
  { id: 'qa-management', label: 'QA 管理', icon: ClipboardList },
  { id: 'tag-management', label: 'Tag 管理', icon: Tags },
  { id: 'app-report', label: 'APP 报告', icon: FileText },
  { id: 'model-management', label: '模型管理', icon: Settings },
  { id: 'evaluation', label: '效果评估', icon: BarChart3 },
  { id: 'feedbacks', label: 'Feedback 管理', icon: MessageCircle },
]
</script>
