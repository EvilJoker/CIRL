<template>
  <tbody class="[&_tr:last-child]:border-0">
    <slot />
  </tbody>
</template>

<script setup lang="ts">
defineOptions({
  name: 'UITableBody'
})
</script>

