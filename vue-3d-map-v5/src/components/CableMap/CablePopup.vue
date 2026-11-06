<template>
  <div class="cable-popup">
    <h3 class="cable-popup__title">{{ cableName }}</h3>
    <div class="cable-popup__meta">
      區段 {{ segmentId }}
      <StatusBadge class="cable-popup__gap" :status="segmentStatus" />
    </div>

    <template v-if="incidents.length">
      <div v-for="(incident, i) in incidents" :key="`seg-${i}`" class="cable-popup__incident">
        <div>
          <StatusBadge :status="incident.status" />
          <span class="cable-popup__incident-title">{{ incident.title || '（未命名事件）' }}</span>
        </div>
        <div class="cable-popup__dates">
          發生：{{ formatDay(incident.date) }}
          <span class="cable-popup__gap">預計修復：{{ formatDay(incident.reparing_at) }}</span>
        </div>
      </div>
    </template>
    <div v-else class="cable-popup__meta">此區段目前無進行中事件</div>

    <template v-if="unlocated.length">
      <div class="cable-popup__section">本海纜其他事件（未標明區段）</div>
      <div v-for="(incident, i) in unlocated" :key="`other-${i}`" class="cable-popup__incident">
        <div>
          <StatusBadge :status="incident.status" />
          <span class="cable-popup__incident-title">{{ incident.title || '（未命名事件）' }}</span>
        </div>
        <div class="cable-popup__dates">
          發生：{{ formatDay(incident.date) }}
          <span class="cable-popup__gap">預計修復：{{ formatDay(incident.reparing_at) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import StatusBadge from './StatusBadge.vue';
import { formatDay } from './lib/format';

defineProps({
  cableName: { type: String, default: '' },
  segmentId: { type: String, default: '' },
  segmentStatus: { type: String, default: 'normal' },
  /** 此區段進行中的事件 */
  incidents: { type: Array, default: () => [] },
  /** 本海纜未標明區段的事件 */
  unlocated: { type: Array, default: () => [] },
});
</script>

<style lang="less" scoped>
@import (reference) './styles/variables.less';

.cable-popup {
  min-width: 220px;
  max-width: 320px;

  &__title { margin: 0 24px 4px 0; font-size: 15px; }
  &__meta { margin-bottom: 8px; color: @cm-muted; font-size: 12px; }
  &__section { margin-top: 12px; color: @cm-muted; font-size: 12px; }
  &__incident { margin-top: 8px; padding-top: 8px; border-top: 1px solid @cm-border; }
  &__incident-title { margin-left: 4px; font-weight: 500; }
  &__dates { margin-top: 2px; color: @cm-muted; font-size: 12px; }
  &__gap { margin-left: 0.75em; }
}
</style>
