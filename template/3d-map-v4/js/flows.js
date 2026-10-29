// 流量流星動畫：依 traffic.json 的時間戳排隊播放「來源國 → SkyCloud 節點」的流星
// 移植自 demo/index.html（D3 版），改用 MapLibre 圖層繪製

import { FLOW, SKYCLOUD_NODES, COUNTRY_COORDS } from './config.js';
import { distanceKm, greatCircle, slicePath, containsPoint } from './geo.js';

const LAYERS = Object.keys(FLOW.color); // 'L7' | 'L4'
const PULSE_DURATION = 1200;
const COUNTRY_GLOW = { rise: 200, hold: 1000, fade: 400 }; // 與 demo 的國家亮起節奏一致

const easeCubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const empty = () => ({ type: 'FeatureCollection', features: [] });

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ---------- 資料整理 ----------

/** traffic.json 的紀錄 → 依時間排序的事件；查不到座標的國家會被略過 */
function normalizeEvents(records) {
  const missing = new Set();
  const events = [];
  for (const r of records) {
    const src = COUNTRY_COORDS[r.country_code];
    const dst = SKYCLOUD_NODES[r.source_node_country]?.coordinates ?? COUNTRY_COORDS[r.source_node_country];
    if (!src) missing.add(r.country_code);
    if (!dst) missing.add(r.source_node_country);
    if (!src || !dst) continue;
    events.push({
      time: Date.parse(r.timestamp),
      srcCode: r.country_code,
      dstCode: r.source_node_country,
      layer: r.block_layer === 'L4' ? 'L4' : 'L7',
    });
  }
  if (missing.size) console.warn('[flows] 找不到座標，已略過這些國家的流量：', [...missing]);
  return events.sort((a, b) => a.time - b.time);
}

function createRouteCache() {
  const cache = new Map();
  return (srcCode, dstCode) => {
    const key = `${srcCode}>${dstCode}`;
    if (!cache.has(key)) {
      const src = COUNTRY_COORDS[srcCode];
      const dst = SKYCLOUD_NODES[dstCode]?.coordinates ?? COUNTRY_COORDS[dstCode];
      const km = distanceKm(src, dst);
      const duration = Math.min(FLOW.maxDuration, Math.max(FLOW.minDuration, (km / FLOW.speedKmPerSec) * 1000));
      cache.set(key, { key, src, dst, path: greatCircle(src, dst), duration });
    }
    return cache.get(key);
  };
}

// 110m 國界沒有這些國家／地區的多邊形，代表點會落到鄰國（SG → 馬來西亞、HK → 中國），所以不亮國家、只顯示光圈
const NO_POLYGON = new Set(['SG', 'HK', 'SC']);

/** 來源國代表點落在哪個國家多邊形內；查不到時為 null */
function createCountryLookup(countries) {
  const cache = new Map();
  return (code) => {
    if (!cache.has(code)) {
      const point = COUNTRY_COORDS[code];
      const found = NO_POLYGON.has(code) ? null : countries.features.find((f) => containsPoint(f.geometry, point));
      cache.set(code, found?.id ?? null);
    }
    return cache.get(code);
  };
}

// ---------- 圖層 ----------

function addLayers(map, countries, beforeId) {
  map.addSource('flow-countries', { type: 'geojson', data: countries });
  map.addSource('flow-meteors', { type: 'geojson', data: empty(), lineMetrics: true });
  map.addSource('flow-pulses', { type: 'geojson', data: empty() });
  map.addSource('flow-nodes', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: Object.entries(SKYCLOUD_NODES).map(([code, node]) => ({
        type: 'Feature',
        properties: { code, name: node.name },
        geometry: { type: 'Point', coordinates: node.coordinates },
      })),
    },
  });

  // 來源國亮起：放在海纜底下，透明度由 feature-state 控制
  map.addLayer({
    id: 'flow-countries-glow',
    type: 'fill',
    source: 'flow-countries',
    paint: {
      'fill-color': FLOW.srcCountryColor,
      'fill-opacity': ['*', 0.5, ['coalesce', ['feature-state', 'glow'], 0]],
    },
  }, beforeId);

  // 流星：尾端透明 → 頭部最亮（line-progress 0 是尾巴、1 是頭）
  for (const layer of LAYERS) {
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
        'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, rgba(color, 0), 0.5, rgba(color, 0.2), 1, rgba(color, 0.7)],
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
        'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, rgba('#ffffff', 0), 0.3, rgba(color, 0.8), 1, color],
      },
    });
  }

  map.addLayer({
    id: 'flow-pulses',
    type: 'circle',
    source: 'flow-pulses',
    paint: {
      'circle-radius': ['get', 'r'],
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 1.5,
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

// ---------- 對外 ----------

/**
 * 建立流量圖層並開始播放。
 * @param {object} opts.beforeId 來源國亮起要插在哪個圖層之下（讓海纜蓋在上面）
 * @returns 播放控制器：play / pause / toggle / setRate / subscribe
 */
export function createFlowLayer(map, { traffic, countries }, { beforeId } = {}) {
  countries.features.forEach((f, i) => { f.id = i; }); // feature-state 需要數字 id
  addLayers(map, countries, beforeId);

  const events = normalizeEvents(traffic);
  const routeOf = createRouteCache();
  const countryOf = createCountryLookup(countries);
  const startTime = events[0]?.time ?? 0;

  const player = {
    playing: true,
    rate: FLOW.playbackRate,
    clock: startTime, // 資料時間（ms）
    count: 0, // 本輪已播放的事件數
  };
  let anim = 0; // 動畫時間（ms），暫停時不前進
  let cursor = 0;
  let loopWaitUntil = null;
  let meteors = [];
  let pulses = [];
  const glowing = new Map(); // country id -> 亮起開始時間
  const listeners = new Set();

  function spawn(event) {
    player.count += 1;
    const route = routeOf(event.srcCode, event.dstCode);

    // 同一條航線還在前半段飛行中：只累加次數（線變粗），不重複畫
    const same = meteors.find((m) => m.route === route && m.layer === event.layer && anim - m.start < route.duration / 2);
    if (same) {
      same.count += 1;
      return;
    }
    if (meteors.length >= FLOW.maxActive) return;

    meteors.push({ route, layer: event.layer, start: anim, count: 1, arrived: false });
    pulses.push({ coord: route.src, color: FLOW.srcCountryColor, start: anim });
    const countryId = countryOf(event.srcCode);
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
      properties: { layer: m.layer, opacity, width: 1.2 }, // 流星寬度固定 1.2px
      // properties: { layer: m.layer, opacity, width: 1.2 + Math.min(m.count, 12) * 0.25 },
      geometry: { type: 'LineString', coordinates: slicePath(route.path, from, to) },
    };
  }

  function updateCountryGlow() {
    const { rise, hold, fade } = COUNTRY_GLOW;
    for (const [id, start] of glowing) {
      const t = anim - start;
      const glow = t < rise ? t / rise : t < rise + hold ? 1 : Math.max(0, 1 - (t - rise - hold) / fade);
      map.setFeatureState({ source: 'flow-countries', id }, { glow });
      if (t >= rise + hold + fade) glowing.delete(id);
    }
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
    while (cursor < events.length && events[cursor].time <= player.clock) spawn(events[cursor++]);

    for (const m of meteors) {
      if (!m.arrived && anim - m.start >= m.route.duration) {
        m.arrived = true;
        pulses.push({ coord: m.route.dst, color: FLOW.dstPulseColor, start: anim });
      }
    }
    meteors = meteors.filter((m) => anim - m.start < m.route.duration + FLOW.fadeDuration);
    pulses = pulses.filter((p) => anim - p.start < PULSE_DURATION);

    // 一輪播完、畫面清空後，等 loopGap 再從頭重播
    if (cursor >= events.length && !meteors.length) {
      player.clock = events.at(-1)?.time ?? startTime;
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
          properties: { color: p.color, r: 3 + k * 18, a: 1 - k },
          geometry: { type: 'Point', coordinates: p.coord },
        };
      }),
    });
    updateCountryGlow();
  }

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
    listeners.forEach((fn) => fn(player));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    play() { player.playing = true; },
    pause() { player.playing = false; },
    toggle() { player.playing = !player.playing; },
    setRate(rate) { player.rate = rate; },
    total: events.length,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
