<template>
  <div class="point-popup">
    <h3 class="point-popup__title">{{ name }}</h3>
    <div class="point-popup__meta">{{ subtitle }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { EQUIPMENT_LABEL } from './lib/config';

const props = defineProps({
  name: { type: String, default: '' },
  /** 設備類型（BMH / BU / AC）；登陸點沒有 */
  type: { type: String, default: '' },
  cableName: { type: String, default: '' },
});

const subtitle = computed(() => (props.type
  ? `${EQUIPMENT_LABEL[props.type] ?? props.type}・${props.cableName}`
  : '登陸點'));
</script>

<style lang="less" scoped>
@import (reference) './styles/variables.less';

.point-popup {
  min-width: 160px;
  max-width: 320px;

  &__title { margin: 0 24px 4px 0; font-size: 15px; }
  &__meta { color: @cm-muted; font-size: 12px; }
}
</style>
