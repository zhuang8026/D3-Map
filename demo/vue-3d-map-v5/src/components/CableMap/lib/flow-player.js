// 流量流星動畫：依 traffic 的時間戳排隊播放「來源國 → SkyCloud 節點」的流星，以 MapLibre 圖層繪製。
// 不依賴 Vue；由 CableMap.vue 建立、更新與銷毀。

import { FLOW } from './config';
import { slicePath } from './geo';
import { normalizeEvents, createRouteCache, createCountryLookup } from './flow-events';
import { formatClock } from './format';

export const FLOW_LAYERS = Object.keys(FLOW.color); // 'L7' | 'L4'

const PULSE_DURATION = 1200;
const PULSE = { radius: 18, width: 1.5 };
// 同國事件沒有航線，光圈放大讓它看得到
const SAME_COUNTRY_PULSE = { radius: 30, width: 2.5 };
// 與原型的國家亮起節奏一致
const COUNTRY_GLOW = { rise: 200, hold: 1000, fade: 400 };

const SOURCES = ['flow-countries', 'flow-meteors', 'flow-pulses', 'flow-nodes'];
const LAYER_IDS = [
  'flow-countries-glow',
  ...FLOW_LAYERS.flatMap((l) => [`flow-meteors-glow-${l}`, `flow-meteors-${l}`]),
  'flow-pulses',
  'flow-nodes',
  'flow-node-labels',
];

const easeCubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const emptyCollection = () => ({ type: 'FeatureCollection', features: [] });

export function rgba(hex, alpha) {
  const channel = (i) => parseInt(hex.slice(i, i + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
}

function nodeCollection(nodes) {
  return {
    type: 'FeatureCollection',
    features: Object.entries(nodes).map(([code, node]) => ({
      type: 'Feature',
      properties: { code, name: node.name },
      geometry: { type: 'Point', coordinates: node.coordinates },
    })),
  };
}

function addLayers(map, { countries, nodes, beforeId }) {
  map.addSource('flow-countries', { type: 'geojson', data: countries });
  map.addSource('flow-meteors', { type: 'geojson', data: emptyCollection(), lineMetrics: true });
  map.addSource('flow-pulses', { type: 'geojson', data: emptyCollection() });
  map.addSource('flow-nodes', { type: 'geojson', data: nodeCollection(nodes) });

  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;

  // 來源國亮起：放在海纜底下，透明度由 feature-state 控制
  map.addLayer({
    id: 'flow-countries-glow',
    type: 'fill',
    source: 'flow-countries',
    paint: {
      'fill-color': FLOW.srcCountryColor,
      'fill-opacity': ['*', 0.5, ['coalesce', ['feature-state', 'glow'], 0]],
    },
  }, before);

  // 流星：尾端透明 → 頭部最亮（line-progress 0 是尾巴、1 是頭）
  FLOW_LAYERS.forEach((layer) => {
    const color = FLOW.color[layer];
    const filter = ['==', ['get', 'layer'], layer];
    map.addLayer({
      id: `flow-meteors-glow-${layer}`,
      type: 'line',
      source: 'flow-meteors',
      filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': ['*', ['get', 'width'], 4],
        'line-blur': 4,
        'line-opacity': ['*', 0.6, ['get', 'opacity']],
        'line-gradient': [
          'interpolate', ['linear'], ['line-progress'],
          0, rgba(color, 0), 0.5, rgba(color, 0.2), 1, rgba(color, 0.7),
        ],
      },
    });
    map.addLayer({
      id: `flow-meteors-${layer}`,
      type: 'line',
      source: 'flow-meteors',
      filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
        'line-gradient': [
          'interpolate', ['linear'], ['line-progress'],
          0, rgba('#ffffff', 0), 0.3, rgba(color, 0.8), 1, color,
        ],
      },
    });
  });

  map.addLayer({
    id: 'flow-pulses',
    type: 'circle',
    source: 'flow-pulses',
    paint: {
      'circle-radius': ['get', 'r'],
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': ['get', 'w'],
      'circle-stroke-opacity': ['get', 'a'],
    },
  });

  map.addLayer({
    id: 'flow-nodes',
    type: 'circle',
    source: 'flow-nodes',
    paint: {
      'circle-radius': 4,
      'circle-color': FLOW.color.L7,
      'circle-stroke-color': '#16171b',
      'circle-stroke-width': 1.5,
    },
  });
  map.addLayer({
    id: 'flow-node-labels',
    type: 'symbol',
    source: 'flow-nodes',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-offset': [0, -1.2],
      'text-anchor': 'bottom',
    },
    paint: { 'text-color': FLOW.color.L7, 'text-halo-color': '#16171b', 'text-halo-width': 1 },
  });
}

function removeLayers(map) {
  // 地圖已被 remove() 時 style 為空，不必再清
  if (!map.style) return;
  LAYER_IDS.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
  SOURCES.forEach((id) => { if (map.getSource(id)) map.removeSource(id); });
}

/**
 * 建立流量圖層並開始播放。
 *
 * @param {import('maplibre-gl').Map} map 已觸發 load 的地圖
 * @param {object} opts
 * @param {object[]} opts.traffic 攔截紀錄
 * @param {object|null} opts.countries 國界 GeoJSON FeatureCollection（來源國亮起用）
 * @param {object} opts.nodes SkyCloud 節點
 * @param {object} opts.countryCoords 國家代表座標
 * @param {string} [opts.beforeId] 來源國亮起要插在哪個圖層之下（讓海纜蓋在上面）
 * @param {boolean} [opts.playing]
 * @param {number} [opts.rate] 播放倍速
 * @param {string[]} [opts.enabledLayers] 要畫的層級
 * @param {(p: { playing: boolean, clock: number, count: number, total: number }) => void}
 *   [opts.onProgress] 播放狀態改變時呼叫（時鐘以分鐘為單位變化，不會每幀觸發）
 */
export function createFlowPlayer(map, {
  traffic = [],
  countries,
  nodes,
  countryCoords,
  beforeId,
  playing = true,
  rate = FLOW.playbackRate,
  enabledLayers = FLOW_LAYERS,
  onProgress = () => {},
}) {
  // feature-state 需要數字 id；複製 feature，不改動傳入的資料
  const countryCollection = {
    type: 'FeatureCollection',
    features: (countries?.features ?? []).map((f, i) => ({ ...f, id: i })),
  };
  addLayers(map, { countries: countryCollection, nodes, beforeId });

  const { events, missing } = normalizeEvents(traffic, { nodes, countryCoords });
  if (missing.length) console.warn('[CableMap] 找不到座標，已略過這些國家的流量：', missing);
  const routeOf = createRouteCache({ nodes, countryCoords, flow: FLOW });
  const countryOf = createCountryLookup(countryCollection, countryCoords);
  const startTime = events[0]?.time ?? 0;

  const player = {
    playing,
    rate,
    clock: startTime, // 資料時間（ms）
    count: 0, // 本輪已播放的事件數
  };
  let anim = 0; // 動畫時間（ms），暫停時不前進
  let cursor = 0;
  let loopWaitUntil = null;
  let meteors = [];
  let pulses = [];
  const glowing = new Map(); // country id -> 亮起開始時間
  const enabled = new Set(enabledLayers);

  function spawn(event) {
    player.count += 1;
    if (!enabled.has(event.layer)) return; // 未勾選的層級只計數、不畫
    const route = routeOf(event.srcCode, event.dstCode);
    const countryId = countryOf(event.srcCode);

    // 同國事件（例如 L4 的 CA → CA）不畫流星，改在目的地顯示該層顏色的光圈
    if (event.srcCode === event.dstCode) {
      pulses.push({
        coord: route.dst,
        color: FLOW.color[event.layer],
        layer: event.layer,
        start: anim,
        ...SAME_COUNTRY_PULSE,
      });
      if (countryId !== null) glowing.set(countryId, anim);
      return;
    }

    // 同一條航線還在前半段飛行中：只累加次數，不重複畫
    const same = meteors.find((m) => m.route === route && m.layer === event.layer
      && anim - m.start < route.duration / 2);
    if (same) {
      same.count += 1;
      return;
    }
    if (meteors.length >= FLOW.maxActive) return;

    meteors.push({
      route, layer: event.layer, start: anim, count: 1, arrived: false,
    });
    pulses.push({
      coord: route.src, color: FLOW.srcCountryColor, layer: event.layer, start: anim, ...PULSE,
    });
    if (countryId !== null) glowing.set(countryId, anim);
  }

  function meteorFeature(m) {
    const { route } = m;
    const t = anim - m.start;
    let from;
    let to;
    let opacity = 1;
    if (t < route.duration) {
      // 前進：頭往前、尾巴維持固定比例
      to = easeCubicInOut(t / route.duration);
      from = Math.max(0, to - FLOW.tail);
    } else {
      // 抵達：尾巴收回並淡出
      const k = Math.min(1, (t - route.duration) / FLOW.fadeDuration);
      to = 1;
      from = Math.max(0, 1 - FLOW.tail) + Math.min(1, FLOW.tail) * k;
      opacity = 1 - k;
    }
    if (to - from < 1e-3) return null;
    return {
      type: 'Feature',
      // 流星寬度固定 1.2px；若要依次數加粗：width: 1.2 + Math.min(m.count, 12) * 0.25
      properties: { layer: m.layer, opacity, width: 1.2 },
      geometry: { type: 'LineString', coordinates: slicePath(route.path, from, to) },
    };
  }

  function glowLevel(t) {
    const { rise, hold, fade } = COUNTRY_GLOW;
    if (t < rise) return t / rise;
    if (t < rise + hold) return 1;
    return Math.max(0, 1 - (t - rise - hold) / fade);
  }

  function updateCountryGlow() {
    const { rise, hold, fade } = COUNTRY_GLOW;
    glowing.forEach((start, id) => {
      const t = anim - start;
      map.setFeatureState({ source: 'flow-countries', id }, { glow: glowLevel(t) });
      if (t >= rise + hold + fade) glowing.delete(id);
    });
  }

  function advance(dt) {
    anim += dt;

    if (loopWaitUntil !== null) {
      if (anim < loopWaitUntil) return;
      loopWaitUntil = null;
      cursor = 0;
      player.clock = startTime;
      player.count = 0;
    }

    player.clock += dt * player.rate;
    while (cursor < events.length && events[cursor].time <= player.clock) {
      spawn(events[cursor]);
      cursor += 1;
    }

    meteors.forEach((m) => {
      if (!m.arrived && anim - m.start >= m.route.duration) {
        // eslint-disable-next-line no-param-reassign
        m.arrived = true;
        pulses.push({
          coord: m.route.dst, color: FLOW.dstPulseColor, layer: m.layer, start: anim, ...PULSE,
        });
      }
    });
    meteors = meteors.filter((m) => anim - m.start < m.route.duration + FLOW.fadeDuration);
    pulses = pulses.filter((p) => anim - p.start < PULSE_DURATION);

    // 一輪播完、畫面清空後，等 loopGap 再從頭重播
    if (cursor >= events.length && !meteors.length) {
      player.clock = events.length ? events[events.length - 1].time : startTime;
      loopWaitUntil = anim + FLOW.loopGap;
    }
  }

  function render() {
    map.getSource('flow-meteors').setData({
      type: 'FeatureCollection',
      features: meteors.map(meteorFeature).filter(Boolean),
    });
    map.getSource('flow-pulses').setData({
      type: 'FeatureCollection',
      features: pulses.map((p) => {
        const k = (anim - p.start) / PULSE_DURATION;
        return {
          type: 'Feature',
          properties: {
            color: p.color, r: 3 + k * p.radius, w: p.width, a: 1 - k,
          },
          geometry: { type: 'Point', coordinates: p.coord },
        };
      }),
    });
    updateCountryGlow();
  }

  // 只在畫面上會看到的值改變時通知（時鐘顯示到分鐘）
  let lastKey = '';
  function notify() {
    const key = `${player.playing}|${formatClock(player.clock)}|${player.count}`;
    if (key === lastKey) return;
    lastKey = key;
    onProgress({
      playing: player.playing, clock: player.clock, count: player.count, total: events.length,
    });
  }

  let raf = 0;
  let last = performance.now();
  let idle = false;
  const tick = (now) => {
    const dt = Math.min(now - last, 100); // 分頁切到背景再回來時，不要一次快轉
    last = now;
    if (player.playing) {
      advance(dt);
      // 畫面上沒東西時不必每幀 setData
      const busy = meteors.length || pulses.length || glowing.size;
      if (busy || !idle) render();
      idle = !busy;
    }
    notify();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  /** 顯示 / 隱藏某層級（'L7' | 'L4'）的流星；取消勾選時立即清掉畫面上該層級的流星與光圈 */
  function setLayerEnabled(layer, on) {
    if (on) {
      enabled.add(layer);
      return;
    }
    enabled.delete(layer);
    meteors = meteors.filter((m) => m.layer !== layer);
    pulses = pulses.filter((p) => p.layer !== layer);
    render(); // 暫停中也要立即更新畫面
  }

  return {
    total: events.length,
    /** 查不到座標而被略過的國家代碼 */
    skippedCodes: missing,
    setPlaying(on) { player.playing = Boolean(on); },
    setRate(value) { player.rate = value; },
    setLayerEnabled,
    /** 一次設定所有要顯示的層級 */
    setEnabledLayers(layers) {
      FLOW_LAYERS.forEach((layer) => {
        const on = layers.includes(layer);
        if (on !== enabled.has(layer)) setLayerEnabled(layer, on);
      });
    },
    /** 停止動畫並移除流量圖層 */
    destroy() {
      cancelAnimationFrame(raf);
      removeLayers(map);
    },
  };
}
