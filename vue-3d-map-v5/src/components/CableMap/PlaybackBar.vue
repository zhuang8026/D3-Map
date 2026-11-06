<template>
  <div class="playback-bar" role="group" aria-label="流量播放">
    <button
      type="button"
      class="playback-bar__toggle"
      :aria-label="playing ? '暫停' : '播放'"
      @click="emit('update:playing', !playing)"
    >
      {{ playing ? '❚❚' : '▶' }}
    </button>
    <span class="playback-bar__clock">{{ clockText }}</span>
    <select v-model.number="rateModel" class="playback-bar__rate" aria-label="播放倍速">
      <option v-for="r in rates" :key="r" :value="r">{{ r }}×</option>
    </select>
    <span class="playback-bar__count">
      已攔截 {{ count.toLocaleString() }} / {{ total.toLocaleString() }}
    </span>
    <span class="playback-bar__legend" role="group" aria-label="顯示的層級">
      <label
        v-for="layer in layers"
        :key="layer"
        class="playback-bar__layer"
        :class="{ 'playback-bar__layer--off': !layersModel.includes(layer) }"
      >
        <input
          v-model="layersModel"
          type="checkbox"
          :value="layer"
          :style="{ accentColor: colors[layer] }"
        >
        <i class="playback-bar__swatch" :style="{ background: colors[layer] }" />
        {{ layer }}
      </label>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { FLOW } from './lib/config';
import { formatClock } from './lib/format';

const props = defineProps({
  playing: { type: Boolean, default: true },
  /** 目前倍速 */
  rate: { type: Number, default: FLOW.playbackRate },
  /** 可選的倍速 */
  rates: { type: Array, default: () => FLOW.rates },
  /** 資料時間（ms） */
  clock: { type: Number, default: 0 },
  /** 本輪已攔截次數 */
  count: { type: Number, default: 0 },
  /** 總事件數 */
  total: { type: Number, default: 0 },
  /** 勾選要顯示的層級 */
  enabledLayers: { type: Array, default: () => Object.keys(FLOW.color) },
});

const emit = defineEmits(['update:playing', 'update:rate', 'update:enabledLayers']);

const layers = Object.keys(FLOW.color);
const colors = FLOW.color;

const clockText = computed(() => (props.total ? formatClock(props.clock) : '—'));

const rateModel = computed({
  get: () => props.rate,
  set: (value) => emit('update:rate', value),
});

const layersModel = computed({
  get: () => props.enabledLayers,
  set: (value) => emit('update:enabledLayers', layers.filter((l) => value.includes(l))),
});
</script>

<style lang="less" scoped>
@import (reference) './styles/variables.less';

.playback-bar {
  .cm-panel();
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;

  &__toggle,
  &__rate {
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    color: @cm-text;
    font: inherit;
    cursor: pointer;

    &:hover { background: rgba(255, 255, 255, 0.16); }
  }

  &__toggle { width: 32px; }
  &__rate { padding: 0 6px; }
  &__clock { font-variant-numeric: tabular-nums; }

  &__count {
    color: @cm-muted;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  &__legend {
    display: flex;
    align-items: center;
    gap: 10px;
    color: @cm-muted;
    font-size: 12px;
  }

  &__layer {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    user-select: none;

    &--off { opacity: 0.45; }

    input { margin: 0; cursor: pointer; }
  }

  &__swatch {
    display: inline-block;
    width: 14px;
    height: 2px;
    margin-left: 4px;
    border-radius: 1px;
  }
}
</style>
