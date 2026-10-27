<script setup>
// 海纜狀態 + 流量流星地圖
// 資料一律由 props 傳入；地圖本體（MapLibre）在 mounted 後才動態載入，
// 所以單元測試環境 mount 父元件時不會碰到 WebGL / window。

import {
  computed, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch,
} from 'vue';
import { useResizeObserver } from '@vueuse/core';
import createCableLayers from './cableLayers';
import createTrafficFlows from './trafficFlows';
import { computeCableStatus, pickRoutes } from './utils/status';
import BASE_STYLE from './utils/baseStyle';
import {
  COUNTRY_COORDS, FLOW, INITIAL_VIEW, LABELS, NO_COUNTRY_POLYGON, SKYCLOUD_NODES,
  VISIBLE_ROUTES, mergeDeep,
} from './utils/defaults';
import CableMapFilter from './CableMapFilter.vue';
import CableMapPlayback from './CableMapPlayback.vue';

const props = defineProps({
  /** 海纜：[{ id, name, color, segments: [{ id, coordinates }], equipments }] */
  cables: { type: Array, required: true },
  /** 事件：[{ cableid, segment, status, title, date, reparing_at, resolved_at }] */
  incidents: { type: Array, default: () => [] },
  /** 登陸點：[{ id, name, coordinates }] */
  landingPoints: { type: Array, default: () => [] },
  /** 攔截紀錄：[{ timestamp, country_code, source_node_country, block_layer }] */
  traffic: { type: Array, default: () => [] },
  /** 國界 GeoJSON FeatureCollection（用於來源國亮起）；null 時只顯示光圈 */
  countries: { type: Object, default: null },
  /** 只顯示這些路線用到的區段；空陣列顯示全部海纜 */
  visibleRoutes: { type: Array, default: () => VISIBLE_ROUTES },
  /** SkyCloud 節點 { TW: { name, coordinates } } */
  nodes: { type: Object, default: () => SKYCLOUD_NODES },
  /** 來源國代表座標 { US: [lng, lat] } */
  countryCoords: { type: Object, default: () => COUNTRY_COORDS },
  /** 不亮國家、只顯示光圈的國家代碼 */
  noCountryPolygon: { type: Array, default: () => NO_COUNTRY_POLYGON },
  /** 覆寫流星參數（見 utils/defaults.js 的 FLOW），只在建立地圖時讀取 */
  flowOptions: { type: Object, default: () => ({}) },
  /** 覆寫介面文字（見 utils/defaults.js 的 LABELS），接 vue-i18n 時使用 */
  labels: { type: Object, default: () => ({}) },
  /** MapLibre style 物件或 URL，只在建立地圖時讀取 */
  mapStyle: { type: [Object, String], default: () => BASE_STYLE },
  /** MapLibre 初始視角（center / zoom 或 bounds），只在建立地圖時讀取 */
  initialView: { type: Object, default: () => INITIAL_VIEW },
  /** 播放列時間的顯示時區 */
  timeZone: { type: String, default: 'Asia/Taipei' },
  autoplay: { type: Boolean, default: true },
  showTraffic: { type: Boolean, default: true },
  showControls: { type: Boolean, default: true },
  /** 狀態篩選，可用 v-model:filter */
  filter: {
    type: String,
    default: 'all',
    validator: (v) => ['all', 'normal', 'abnormal'].includes(v),
  },
});

const emit = defineEmits(['ready', 'error', 'select-cable', 'update:filter']);

const container = ref(null);
const phase = ref('loading'); // 'loading' | 'ready' | 'error'
const tip = ref(null); // { x, y, name, sub }
const state = reactive({ filter: 'all', hoveredCableId: null, selectedCableId: null });
const player = reactive({
  playing: false, rate: 0, clock: 0, count: 0, total: 0,
});

const labelText = computed(() => mergeDeep(LABELS, props.labels));
const flow = computed(() => mergeDeep(FLOW, props.flowOptions));

// 用 toRaw 讀資料：海纜座標有上萬個點，透過 reactive proxy 逐一讀取會很慢。
// 因此要更新資料時請「換一個新陣列」，原地修改陣列不會觸發更新。
const cableData = computed(() => {
  const picked = pickRoutes({
    cables: toRaw(props.cables),
    landingPoints: toRaw(props.landingPoints),
  }, toRaw(props.visibleRoutes));
  return { ...picked, statusMap: computeCableStatus(picked.cables, toRaw(props.incidents)) };
});

// MapLibre 相關物件都放在一般變數，不放進 ref，避免被 Vue 深層代理
let map = null;
let cableLayers = null;
let flows = null;
let disposed = false;

function setState(patch) {
  Object.assign(state, patch);
}

// 播放列只在顯示內容改變時更新（時間到分鐘），避免每幀觸發 Vue 重繪
function syncPlayer(p) {
  const minute = Math.floor(p.clock / 60000) * 60000;
  if (player.playing === p.playing && player.rate === p.rate && player.count === p.count
    && player.total === p.total && player.clock === minute) return;
  Object.assign(player, {
    playing: p.playing, rate: p.rate, count: p.count, total: p.total, clock: minute,
  });
}

onMounted(async () => {
  try {
    const [{ default: maplibregl }] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ]);
    if (disposed) return;

    map = new maplibregl.Map({
      container: container.value,
      style: props.mapStyle,
      ...props.initialView,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    await new Promise((resolve) => { map.once('load', resolve); });
    if (disposed) return;

    cableLayers = createCableLayers(map, maplibregl, {
      getState: () => state,
      setState,
      onTip: (value) => { tip.value = value; },
      getLabels: () => labelText.value,
    });
    cableLayers.setData(cableData.value);

    if (props.showTraffic) {
      flows = createTrafficFlows(map, {
        flow: flow.value,
        nodes: toRaw(props.nodes),
        countryCoords: toRaw(props.countryCoords),
        noPolygon: toRaw(props.noCountryPolygon),
        countries: toRaw(props.countries),
        beforeId: 'cables-glow', // 來源國亮起在海纜底下，流星與節點在最上層
        autoplay: props.autoplay,
        onTick: syncPlayer,
      });
      flows.setTraffic(toRaw(props.traffic));
    }

    phase.value = 'ready';
    emit('ready', map);
  } catch (err) {
    phase.value = 'error';
    emit('error', err);
  }
});

onBeforeUnmount(() => {
  disposed = true;
  flows?.destroy();
  cableLayers?.destroy();
  map?.remove();
  map = null;
  cableLayers = null;
  flows = null;
});

// 容器大小改變（例如 grid-layout-plus 縮放卡片）時，MapLibre 不會自己偵測
useResizeObserver(container, () => map?.resize());

watch(cableData, (data) => cableLayers?.setData(data));
watch(() => props.traffic, (records) => flows?.setTraffic(toRaw(records)));
watch(state, (s) => cableLayers?.applyState(s));
watch(() => props.filter, (value) => { state.filter = value; }, { immediate: true });
watch(() => state.filter, (value) => emit('update:filter', value));
watch(() => state.selectedCableId, (id) => emit('select-cable', id));

const play = () => flows?.play();
const pause = () => flows?.pause();
const toggle = () => flows?.toggle();
const setRate = (rate) => flows?.setRate(rate);

defineExpose({
  play,
  pause,
  toggle,
  setRate,
  /** 取得 MapLibre 實例（尚未載入完成時為 null） */
  getMap: () => map,
});
</script>

<template>
  <div class="cable-map">
    <div ref="container" class="cable-map__canvas" />

    <CableMapFilter
      v-if="showControls"
      v-model="state.filter"
      :labels="labelText.filter"
    />

    <CableMapPlayback
      v-if="showControls && showTraffic && phase === 'ready'"
      :player="player"
      :rates="flow.rates"
      :colors="flow.color"
      :labels="labelText"
      :time-zone="timeZone"
      @toggle="toggle"
      @update:rate="setRate"
    />

    <div
      v-if="tip"
      class="cable-map__tip"
      :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
    >
      <div class="name">{{ tip.name }}</div>
      <div v-if="tip.sub" class="sub">{{ tip.sub }}</div>
    </div>

    <div v-if="phase !== 'ready'" class="cable-map__status">
      {{ phase === 'error' ? labelText.loadFailed : labelText.loading }}
    </div>
  </div>
</template>

<style lang="less" scoped>
// 顏色變數定義在元件根元素上，不污染 :root
.cable-map {
  --cm-bg: #16171b;
  --cm-panel: rgba(28, 29, 34, 0.92);
  --cm-border: rgba(255, 255, 255, 0.12);
  --cm-text: #e8e9ec;
  --cm-muted: #9a9ca5;
  --cm-broken: #ff3b3b;
  --cm-partial: #ffa31a;
  --cm-notice: #4da3ff;
  --cm-normal: #3ddc84;

  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
  background: var(--cm-bg);
  color: var(--cm-text);
  font-family: "Noto Sans TC", system-ui, -apple-system, "PingFang TC", sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

.cable-map__canvas {
  position: absolute;
  inset: 0;
}

.cable-map__tip {
  position: absolute;
  z-index: 10;
  padding: 6px 10px;
  border: 1px solid var(--cm-border);
  border-radius: 6px;
  background: var(--cm-panel);
  backdrop-filter: blur(6px);
  white-space: nowrap;
  pointer-events: none;
  transform: translate(14px, 14px);

  .name { font-weight: 600; }

  .sub {
    color: var(--cm-muted);
    font-size: 12px;
  }
}

.cable-map__status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--cm-muted);
}

// ---------- MapLibre 產生的 DOM（Popup、控制項）：只覆寫本元件內的 ----------

:deep(.maplibregl-popup-content) {
  padding: 12px 14px;
  border: 1px solid var(--cm-border);
  border-radius: 8px;
  background: var(--cm-panel);
  color: var(--cm-text);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
}

:deep(.maplibregl-popup-tip) { display: none; }

:deep(.maplibregl-popup-close-button) {
  padding: 2px 8px;
  color: var(--cm-muted);
  font-size: 18px;

  &:hover {
    background: transparent;
    color: var(--cm-text);
  }
}

:deep(.maplibregl-ctrl-attrib) { background: rgba(0, 0, 0, 0.5) !important; }
:deep(.maplibregl-ctrl-attrib a) { color: var(--cm-muted) !important; }

:deep(.pop) {
  min-width: 220px;
  max-width: 320px;

  h3 {
    margin: 0 24px 4px 0;
    color: var(--cm-text);
    font-size: 15px;
  }

  .meta {
    margin-bottom: 8px;
    color: var(--cm-muted);
    font-size: 12px;
  }

  .section-title {
    margin-top: 12px;
    color: var(--cm-muted);
    font-size: 12px;
  }

  .incident {
    margin-top: 8px;
    padding: 8px 0 0;
    border-top: 1px solid var(--cm-border);

    .title { font-weight: 500; }

    .dates {
      margin-top: 2px;
      color: var(--cm-muted);
      font-size: 12px;
    }
  }

  .badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;

    &.normal { background: rgba(61, 220, 132, 0.15); color: var(--cm-normal); }
    &.partial_disconnected { background: rgba(255, 163, 26, 0.15); color: var(--cm-partial); }
    &.disconnected { background: rgba(255, 59, 59, 0.15); color: var(--cm-broken); }
    &.notice { background: rgba(77, 163, 255, 0.15); color: var(--cm-notice); }
  }
}
</style>
