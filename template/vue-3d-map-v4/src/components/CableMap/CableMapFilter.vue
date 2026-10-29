<script setup>
// 海纜狀態篩選：全部 / 正常 / 異常

defineProps({
  modelValue: { type: String, default: 'all' },
  labels: { type: Object, required: true },
});
defineEmits(['update:modelValue']);

const OPTIONS = ['all', 'normal', 'abnormal'];
</script>

<template>
  <div class="cable-map-filter" role="group">
    <button
      v-for="option in OPTIONS"
      :key="option"
      type="button"
      :class="{ active: modelValue === option }"
      :aria-pressed="modelValue === option"
      @click="$emit('update:modelValue', option)"
    >
      {{ labels[option] }}
    </button>
  </div>
</template>

<style lang="less" scoped>
.cable-map-filter {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 5;
  display: flex;
  padding: 3px;
  border: 1px solid var(--cm-border);
  border-radius: 8px;
  background: var(--cm-panel);

  button {
    padding: 6px 14px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--cm-muted);
    font: inherit;
    cursor: pointer;

    &:hover { color: var(--cm-text); }

    &.active {
      background: rgba(255, 255, 255, 0.12);
      color: var(--cm-text);
    }
  }
}
</style>
