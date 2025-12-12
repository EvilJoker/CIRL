<template>
  <th
    class="h-10 px-2 text-left align-middle text-xs font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
  >
    <slot />
  </th>
</template>

<script setup lang="ts">
defineOptions({
  name: 'UITableHead'
})
</script>

