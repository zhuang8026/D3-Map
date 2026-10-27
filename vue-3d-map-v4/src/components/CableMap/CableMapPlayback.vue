<script setup>
// 流量播放控制列：播放 / 暫停、倍速、資料時間與已攔截次數

import { computed } from 'vue';

const props = defineProps({
  player: { type: Object, required: true }, // { playing, rate, clock, count, total }
  rates: { type: Array, required: true },
  colors: { type: Object, required: true }, // { L7: '#…', L4: '#…' }
  labels: { type: Object, required: true },
  timeZone: { type: String, default: 'Asia/Taipei' },
});
defineEmits(['toggle', 'update:rate']);

const formatter = computed(() => new Intl.DateTimeFormat('sv-SE', {
  timeZone: props.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}));

// sv-SE 的格式剛好是 YYYY-MM-DD HH:mm
const clock = computed(() => (props.player.total ? formatter.value.format(props.player.clock) : '—'));
const count = computed(() => (
  `${props.labels.blocked} ${props.player.count.toLocaleString()} / ${props.player.total.toLocaleString()}`
));
</script>

<template>
  <div class="cable-map-playback" role="group">
    <button
      type="button"
      :aria-label="player.playing ? labels.pause : labels.play"
      :title="player.playing ? labels.pause : labels.play"
      @click="$emit('toggle')"
    >
      {{ player.playing ? '❚❚' : '▶' }}
    </button>
    <span class="clock">{{ clock }}</span>
    <select
      :value="player.rate"
      :aria-label="labels.speed"
      @change="$emit('update:rate', Number($event.target.value))"
    >
      <option v-for="rate in rates" :key="rate" :value="rate">{{ rate }}×</option>
    </select>
    <span class="count">{{ count }}</span>
    <span class="legend">
      <template v-for="(color, layer) in colors" :key="layer">
        <i :style="{ background: color }" />{{ layer }}
      </template>
    </span>
  </div>
</template>

<style lang="less" scoped>
.cable-map-playback {
  position: absolute;
  left: 16px;
  bottom: 24px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 32px);
  padding: 6px 12px 6px 6px;
  border: 1px solid var(--cm-border);
  border-radius: 8px;
  background: var(--cm-panel);

  button,
  select {
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--cm-text);
    font: inherit;
    cursor: pointer;
  }

  button {
    width: 32px;

    &:hover { background: rgba(255, 255, 255, 0.16); }
  }

  select { padding: 0 6px; }

  .clock { font-variant-numeric: tabular-nums; }

  .count {
    color: var(--cm-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--cm-muted);
    font-size: 12px;

    i {
      display: inline-block;
      width: 14px;
      height: 2px;
      margin-left: 4px;
      border-radius: 1px;
    }
  }
}
</style>
