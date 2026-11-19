<template>
  <div class="map-filter" role="group" aria-label="狀態篩選">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="map-filter__button"
      :class="{ 'map-filter__button--active': option.value === modelValue }"
      :aria-pressed="option.value === modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  /** 'all' | 'normal' | 'abnormal' */
  modelValue: { type: String, default: 'all' },
});

const emit = defineEmits(['update:modelValue']);

const options = [
  { value: 'all', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'abnormal', label: '異常' },
];
</script>

<style lang="less" scoped>
@import (reference) './styles/variables.less';

.map-filter {
  .cm-panel();
  display: flex;
  padding: 3px;

  &__button {
    padding: 6px 14px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: @cm-muted;
    font: inherit;
    cursor: pointer;

    &:hover { color: @cm-text; }

    &--active {
      background: rgba(255, 255, 255, 0.12);
      color: @cm-text;
    }
  }
}
</style>
