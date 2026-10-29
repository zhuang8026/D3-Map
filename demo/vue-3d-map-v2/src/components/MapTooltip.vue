<script setup lang="ts">
defineProps<{
  visible: boolean
  text: string
  x: number
  y: number
}>()
</script>

<template>
  <div id="tooltip" :style="{ opacity: visible ? 1 : 0, left: x + 'px', top: y + 'px' }">
    {{ text }}
  </div>
</template>

<style scoped>
#tooltip {
  position: fixed;
  pointer-events: none;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  transform: translate(-50%, -120%);
  transition: opacity 0.15s;
}
</style>
