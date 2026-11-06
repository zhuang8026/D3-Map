<template>
  <div class="cable-map">
    <div ref="mapEl" class="cable-map__canvas" />

    <template v-if="controls">
      <MapFilter v-model="filterModel" class="cable-map__filter" />
      <PlaybackBar
        v-model:playing="playingModel"
        v-model:rate="rateModel"
        v-model:enabled-layers="layersModel"
        class="cable-map__playback"
        :rates="FLOW.rates"
        :clock="progress.clock"
        :count="progress.count"
        :total="progress.total"
      />
    </template>

    <HoverTip v-if="hoverTip" v-bind="hoverTip" />

    <!-- Popup 內容由 Vue 渲染，再交給 MapLibre Popup 顯示（setDOMContent） -->
    <div class="cable-map__popup-holder" hidden>
      <div ref="popupEl">
        <CablePopup v-if="popupContent?.kind === 'cable'" v-bind="popupContent.props" />
        <PointPopup v-else-if="popupContent?.kind === 'point'" v-bind="popupContent.props" />
      </div>
    </div>

    <div v-if="loading || !mapReady" class="cable-map__loading">載入中…</div>

    <slot />
  </div>
</template>

<script setup>
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ref, shallowRef, watch, nextTick, toRaw, onMounted, onBeforeUnmount,
} from 'vue';
import MapFilter from './MapFilter.vue';
import PlaybackBar from './PlaybackBar.vue';
import HoverTip from './HoverTip.vue';
import CablePopup from './CablePopup.vue';
import PointPopup from './PointPopup.vue';
import useSyncedProp from './composables/useSyncedProp';
import {
  INITIAL_VIEW, BASE_STYLE, VISIBLE_ROUTES, SKYCLOUD_NODES, COUNTRY_COORDS, FLOW,
} from './lib/config';
import { computeCableStatus } from './lib/status';
import { pickRoutes } from './lib/routes';
import {
  addCableLayers, setCableData, applyCableState, startGlowAnimation,
  CABLE_HIT_LAYER, POINT_LAYERS, CABLE_BOTTOM_LAYER,
} from './lib/cable-layers';
import { createFlowPlayer, FLOW_LAYERS } from './lib/flow-player';

const props = defineProps({
  // ---------- 資料 ----------
  /** 海纜：[{ id, name, color, segments: [{ id, coordinates, ... }], equipments }] */
  cables: { type: Array, default: () => [] },
  /** 海纜事件：[{ cableid, segment, status, title, date, reparing_at, resolved_at }] */
  incidents: { type: Array, default: () => [] },
  /** 登陸點：[{ name, coordinates }] */
  landingPoints: { type: Array, default: () => [] },
  /** 攔截紀錄：[{ timestamp, country_code, source_node_country, block_layer }] */
  traffic: { type: Array, default: () => [] },
  /** 國界 GeoJSON FeatureCollection（來源國亮起用）；沒給時不亮國家 */
  countries: { type: Object, default: null },
  /** 父元件仍在載入資料時設為 true，顯示「載入中」 */
  loading: { type: Boolean, default: false },

  // ---------- 設定（預設值見 lib/config.js） ----------
  /** 要顯示的海纜路線；空陣列顯示全部海纜 */
  visibleRoutes: { type: Array, default: () => VISIBLE_ROUTES },
  /** SkyCloud 節點（流量的目的地）：{ TW: { name, coordinates } } */
  nodes: { type: Object, default: () => SKYCLOUD_NODES },
  /** 國家代表座標：{ TW: [lng, lat] } */
  countryCoords: { type: Object, default: () => COUNTRY_COORDS },
  /** MapLibre 底圖 style（物件或 URL）；只在建立地圖時讀取 */
  mapStyle: { type: [Object, String], default: () => BASE_STYLE },
  /** 初始視角（MapLibre Map 選項：bounds、center、zoom 等）；只在建立地圖時讀取 */
  initialView: { type: Object, default: () => INITIAL_VIEW },
  /** 是否顯示內建的篩選與播放控制列 */
  controls: { type: Boolean, default: true },

  // ---------- 可選的 v-model（不綁定時由元件自己保存） ----------
  /** 海纜狀態篩選：'all' | 'normal' | 'abnormal' */
  filter: {
    type: String,
    default: 'all',
    validator: (v) => ['all', 'normal', 'abnormal'].includes(v),
  },
  playing: { type: Boolean, default: true },
  playbackRate: { type: Number, default: FLOW.playbackRate },
  /** 要顯示的流量層級 */
  enabledLayers: { type: Array, default: () => FLOW_LAYERS },
});

const emit = defineEmits([
  'update:filter',
  'update:playing',
  'update:playbackRate',
  'update:enabledLayers',
  /** 地圖載入完成：(map) */
  'map-load',
  /** 流量資料整理完成：({ total, skippedCodes }) */
  'flow-ready',
  /** 播放進度：({ playing, clock, count, total })，時鐘以分鐘為單位變化 */
  'progress',
  /** 選取的海纜改變：(cableId | null) */
  'select',
  /** MapLibre 錯誤：(error) */
  'error',
]);

const filterModel = useSyncedProp(props, emit, 'filter');
const playingModel = useSyncedProp(props, emit, 'playing');
const rateModel = useSyncedProp(props, emit, 'playbackRate');
const layersModel = useSyncedProp(props, emit, 'enabledLayers');

const mapEl = ref(null);
const popupEl = ref(null);
const mapReady = ref(false);
const hoveredCableId = ref(null);
const selectedCableId = ref(null);
const hoverTip = ref(null); // { x, y, name, sub }
const popupContent = shallowRef(null); // { kind: 'cable' | 'point', props }
const progress = ref({
  playing: true, clock: 0, count: 0, total: 0,
});

// MapLibre 物件不放進響應式系統
let map = null;
let popup = null;
let player = null;
let stopGlow = null;
let statusMap = new Map();

// ---------- 資料 → 圖層 ----------

function refreshCables() {
  const visible = pickRoutes(
    { cables: toRaw(props.cables), landingPoints: toRaw(props.landingPoints) },
    toRaw(props.visibleRoutes),
  );
  statusMap = computeCableStatus(visible.cables, toRaw(props.incidents));
  setCableData(map, { ...visible, statusMap });
}

function rebuildFlows() {
  if (player) player.destroy();
  player = createFlowPlayer(map, {
    traffic: toRaw(props.traffic),
    countries: toRaw(props.countries),
    nodes: toRaw(props.nodes),
    countryCoords: toRaw(props.countryCoords),
    beforeId: CABLE_BOTTOM_LAYER, // 來源國亮起插在海纜底下
    playing: playingModel.value,
    rate: rateModel.value,
    enabledLayers: layersModel.value,
    onProgress: (p) => {
      progress.value = p;
      emit('progress', p);
    },
  });
  emit('flow-ready', { total: player.total, skippedCodes: player.skippedCodes });
}

watch(
  [mapReady, () => props.cables, () => props.incidents, () => props.landingPoints,
    () => props.visibleRoutes],
  () => { if (mapReady.value) refreshCables(); },
);

watch(
  [mapReady, () => props.traffic, () => props.countries, () => props.nodes,
    () => props.countryCoords],
  () => { if (mapReady.value) rebuildFlows(); },
);

watch(
  [mapReady, filterModel, hoveredCableId, selectedCableId],
  () => {
    if (!mapReady.value) return;
    applyCableState(map, {
      filter: filterModel.value,
      hoveredCableId: hoveredCableId.value,
      selectedCableId: selectedCableId.value,
    });
  },
);

watch(playingModel, (on) => player?.setPlaying(on));
watch(rateModel, (rate) => player?.setRate(rate));
watch(layersModel, (layers) => player?.setEnabledLayers(layers));
watch(selectedCableId, (id) => emit('select', id));

// ---------- 滑鼠互動 ----------

function clearSelection() {
  if (popup) popup.remove();
  selectedCableId.value = null;
}

async function openPopup(lngLat, content) {
  popupContent.value = content;
  await nextTick(); // 等 Vue 渲染完內容，Popup 才能正確定位
  popup.setLngLat(lngLat).setDOMContent(popupEl.value).addTo(map);
}

function queryPoint(e) {
  return map.queryRenderedFeatures(e.point, { layers: POINT_LAYERS })[0];
}

function queryCable(e) {
  return map.queryRenderedFeatures(e.point, { layers: [CABLE_HIT_LAYER] })[0];
}

function onMouseMove(e) {
  const { clientX: x, clientY: y } = e.originalEvent;
  const point = queryPoint(e);
  const cable = point ? null : queryCable(e);
  const hit = point || cable;
  map.getCanvas().style.cursor = hit ? 'pointer' : '';
  hoveredCableId.value = hit?.properties.cableId ?? null;
  if (point) {
    hoverTip.value = {
      x, y, name: point.properties.name, sub: point.properties.cableName ?? '',
    };
  } else if (cable) {
    hoverTip.value = {
      x, y, name: cable.properties.cableName, sub: cable.properties.segmentId,
    };
  } else {
    hoverTip.value = null;
  }
}

function onMouseLeave() {
  hoveredCableId.value = null;
  hoverTip.value = null;
}

async function onClick(e) {
  hoverTip.value = null;

  const point = queryPoint(e);
  if (point) {
    const { name, type, cableName } = point.properties;
    await openPopup(point.geometry.coordinates, {
      kind: 'point',
      props: { name, type: type ?? '', cableName: cableName ?? '' },
    });
    selectedCableId.value = point.properties.cableId ?? null;
    return;
  }

  const cable = queryCable(e);
  if (cable) {
    const { cableId, cableName, segmentId } = cable.properties;
    const cableStatus = statusMap.get(cableId);
    const seg = cableStatus.segments.get(segmentId);
    await openPopup(e.lngLat, {
      kind: 'cable',
      props: {
        cableName,
        segmentId,
        segmentStatus: seg.status,
        incidents: seg.incidents,
        unlocated: cableStatus.unlocated,
      },
    });
    selectedCableId.value = cableId;
    return;
  }

  // 點空白處：取消選取
  clearSelection();
}

function onKeyDown(e) {
  if (e.key === 'Escape') clearSelection();
}

// 版權標示預設收合成 ⓘ 按鈕（MapLibre 拿到版權文字時會自動展開），點按鈕可再展開
function collapseAttribution() {
  const el = map?.getContainer().querySelector('.maplibregl-ctrl-attrib.maplibregl-compact');
  if (el) el.classList.remove('maplibregl-compact-show');
}

// ---------- 生命週期 ----------

onMounted(() => {
  map = new maplibregl.Map({
    container: mapEl.value,
    style: toRaw(props.mapStyle),
    ...toRaw(props.initialView),
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.on('error', (e) => emit('error', e.error ?? e));

  popup = new maplibregl.Popup({
    closeButton: true, closeOnClick: false, maxWidth: '340px', offset: 10,
  });
  // 關閉 Popup（含 × 按鈕）即取消選取；切換到另一條海纜時會先觸發 close，再設定新的選取
  popup.on('close', () => { selectedCableId.value = null; });

  map.once('load', () => {
    addCableLayers(map);
    stopGlow = startGlowAnimation(map);
    map.on('mousemove', onMouseMove);
    map.on('click', onClick);
    map.getCanvas().addEventListener('mouseleave', onMouseLeave);
    collapseAttribution();
    map.once('idle', collapseAttribution); // 版權文字較晚載入時再收一次
    mapReady.value = true;
    emit('map-load', map);
  });

  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
  if (stopGlow) stopGlow();
  if (player) player.destroy();
  if (popup) popup.remove();
  if (map) map.remove();
  map = null;
  popup = null;
  player = null;
});

defineExpose({
  /** 取得 MapLibre Map 實例（載入前為 null） */
  getMap: () => map,
  /** 關閉 Popup 並取消選取 */
  clearSelection,
});
</script>

<style lang="less" scoped>
@import (reference) './styles/variables.less';

.cable-map {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: @cm-bg;
  color: @cm-text;
  font-family: @cm-font;
  font-size: 14px;

  &__canvas {
    position: absolute;
    inset: 0;
  }

  &__filter {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 5;
  }

  &__playback {
    position: absolute;
    left: 16px;
    bottom: 24px;
    z-index: 5;
    max-width: calc(100% - 32px);
  }

  &__loading {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 6;
    transform: translate(-50%, -50%);
    color: @cm-muted;
  }

  // ---------- 覆寫 MapLibre 預設樣式 ----------
  :deep(.maplibregl-popup-content) {
    .cm-panel();
    padding: 12px 14px;
    color: @cm-text;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px);
  }

  :deep(.maplibregl-popup-tip) { display: none; }

  :deep(.maplibregl-popup-close-button) {
    padding: 2px 8px;
    color: @cm-muted;
    font-size: 18px;

    &:hover { background: transparent; color: @cm-text; }
  }

  :deep(.maplibregl-ctrl-attrib) { background: rgba(0, 0, 0, 0.5); }
  :deep(.maplibregl-ctrl-attrib a) { color: @cm-muted; }
}
</style>
