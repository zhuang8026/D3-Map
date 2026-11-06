<template>
  <span class="status-badge" :class="`status-badge--${status}`">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue';
import { STATUS_LABEL } from './lib/config';

const props = defineProps({
  status: { type: String, required: true },
});

const label = computed(() => STATUS_LABEL[props.status] ?? props.status);
</script>

<style lang="less" scoped>
@import (reference) './styles/variables.less';

.status-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;

  &--normal { background: fade(@cm-normal, 15%); color: @cm-normal; }
  &--notice { background: fade(@cm-notice, 15%); color: @cm-notice; }
  &--partial_disconnected { background: fade(@cm-partial, 15%); color: @cm-partial; }
  &--disconnected { background: fade(@cm-broken, 15%); color: @cm-broken; }
}
</style>
