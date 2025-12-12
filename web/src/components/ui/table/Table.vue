<template>
  <div
    class="w-full overflow-auto rounded-md border"
    role="table-container"
  >
    <table
      v-bind="$attrs"
      class="w-full caption-bottom text-sm"
    >
      <slot />
    </table>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'UITable'
})
</script>

