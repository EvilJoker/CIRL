<template>
  <tr
    class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
    role="row"
  >
    <slot />
  </tr>
</template>

<script setup lang="ts">
defineOptions({
  name: 'UITableRow'
})
</script>

