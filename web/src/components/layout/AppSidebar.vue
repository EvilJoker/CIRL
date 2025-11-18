<template>
  <SidebarProvider>
    <Sidebar :collapsible="'icon'" class="border-r">
      <SidebarPanel />
    </Sidebar>
    <SidebarInset>
      <slot />
    </SidebarInset>
  </SidebarProvider>
</template>

<script setup lang="ts">
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import SidebarPanel from './SidebarPanel.vue'
</script>
