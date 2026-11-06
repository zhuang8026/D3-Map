<template>
  <div class="hover-tip" :style="{ left: `${x}px`, top: `${y}px` }">
    <div class="hover-tip__name">{{ name }}</div>
    <div v-if="sub" class="hover-tip__sub">{{ sub }}</div>
  </div>
</template>

<script setup>
defineProps({
  /** 游標的 viewport 座標（clientX / clientY） */
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  name: { type: String, default: '' },
  sub: { type: String, default: '' },
});
</script>

<style lang="less" scoped>
@import (reference) './styles/variables.less';

.hover-tip {
  .cm-panel();
  position: fixed;
  z-index: 10;
  padding: 6px 10px;
  border-radius: 6px;
  backdrop-filter: blur(6px);
  white-space: nowrap;
  pointer-events: none;
  transform: translate(14px, 14px);

  &__name { font-weight: 600; }
  &__sub { color: @cm-muted; font-size: 12px; }
}
</style>
