// 流量流星動畫：依攔截紀錄的時間戳排隊播放「來源國 → SkyCloud 節點」的流星
// 移植自 demo/index.html（D3 版），改用 MapLibre 圖層繪製；不依賴 Vue

import {
  distanceKm, greatCircle, slicePath, containsPoint,
} from './utils/geo';

const PULSE_DURATION = 1200;
const COUNTRY_GLOW = { rise: 200, hold: 1000, fade: 400 }; // 與 demo 的國家亮起節奏一致

const easeCubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const empty = () => ({ type: 'FeatureCollection', features: [] });

function rgba(hex, alpha) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 國家亮起的強度（0..1）：淡入 → 維持 → 淡出 */
function glowAt(t) {
  const { rise, hold, fade } = COUNTRY_GLOW;
  if (t < rise) return t / rise;
  if (t < rise + hold) return 1;
  return Math.max(0, 1 - (t - rise - hold) / fade);
}

// ---------- 資料整理 ----------

/** 攔截紀錄 → 依時間排序的事件；查不到座標的國家會被略過 */
function normalizeEvents(records, coordOf) {
  const missing = new Set();
  const events = records.reduce((acc, r) => {
    const src = coordOf.src(r.country_code);
    const dst = coordOf.dst(r.source_node_country);
    if (!src) missing.add(r.country_code);
    if (!dst) missing.add(r.source_node_country);
    if (src && dst) {
      acc.push({
        time: Date.parse(r.timestamp),
        srcCode: r.country_code,
        dstCode: r.source_node_country,
        layer: r.block_layer === 'L4' ? 'L4' : 'L7',
      });
    }
    return acc;
  }, []);
  if (missing.size) {
    // eslint-disable-next-line no-console
    console.warn('[CableMap] 找不到座標，已略過這些國家的流量：', [...missing]);
  }
  return events.sort((a, b) => a.time - b.time);
}

function createRouteCache(coordOf, flow) {
  const cache = new Map();
  return (srcCode, dstCode) => {
    const key = `${srcCode}>${dstCode}`;
    if (!cache.has(key)) {
      const src = coordOf.src(srcCode);
      const dst = coordOf.dst(dstCode);
      const ms = (distanceKm(src, dst) / flow.speedKmPerSec) * 1000;
      const duration = Math.min(flow.maxDuration, Math.max(flow.minDuration, ms));
      cache.set(key, {
        key, src, dst, path: greatCircle(src, dst), duration,
      });
    }
    return cache.get(key);
  };
}

/** 來源國代表點落在哪個國家多邊形內；查不到時為 null */
function createCountryLookup(countries, countryCoords, noPolygon) {
  const cache = new Map();
  const skip = new Set(noPolygon);
  return (code) => {
    if (!cache.has(code)) {
      const point = countryCoords[code];
      const found = !countries || skip.has(code)
        ? null
        : countries.features.find((f) => containsPoint(f.geometry, point));
      cache.set(code, found?.id ?? null);
    }
    return cache.get(code);
  };
}

/** feature-state 需要數字 id；沒有的話補上（不修改傳入的資料） */
function withNumericIds(countries) {
  if (!countries) return empty();
  if (countries.features.every((f) => typeof f.id === 'number')) return countries;
  return { ...countries, features: countries.features.map((f, i) => ({ ...f, id: i })) };
}

// ---------- 圖層 ----------

function nodeFeatures(nodes) {
  return {
    type: 'FeatureCollection',
    features: Object.entries(nodes).map(([code, node]) => ({
      type: 'Feature',
      properties: { code, name: node.name },
      geometry: { type: 'Point', coordinates: node.coordinates },
    })),
  };
}

function addLayers(map, { countries, nodes, flow }, beforeId) {
  map.addSource('flow-countries', { type: 'geojson', data: countries });
  map.addSource('flow-meteors', { type: 'geojson', data: empty(), lineMetrics: true });
  map.addSource('flow-pulses', { type: 'geojson', data: empty() });
  map.addSource('flow-nodes', { type: 'geojson', data: nodeFeatures(nodes) });

  // 來源國亮起：放在海纜底下，透明度由 feature-state 控制
  map.addLayer({
    id: 'flow-countries-glow',
    type: 'fill',
    source: 'flow-countries',
    paint: {
      'fill-color': flow.srcCountryColor,
      'fill-opacity': ['*', 0.5, ['coalesce', ['feature-state', 'glow'], 0]],
    },
  }, beforeId);

  // 流星：尾端透明 → 頭部最亮（line-progress 0 是尾巴、1 是頭）
  Object.entries(flow.color).forEach(([layer, color]) => {
    const filter = ['==', ['get', 'layer'], layer];
    const progress = ['line-progress'];
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
          'interpolate', ['linear'], progress,
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
          'interpolate', ['linear'], progress,
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
      'circle-color': flow.color.L7,
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
    paint: { 'text-color': flow.color.L7, 'text-halo-color': '#16171b', 'text-halo-width': 1 },
  });
}

// ---------- 對外 ----------

/**
 * 建立流量圖層並開始播放。
 * @param {import('maplibre-gl').Map} map 已觸發 load 的地圖
 * @param {object} opts
 * @param {object} opts.flow 流星參數（見 utils/defaults.js 的 FLOW）
 * @param {object} opts.nodes SkyCloud 節點 { TW: { name, coordinates } }
 * @param {object} opts.countryCoords 來源國代表座標 { US: [lng, lat] }
 * @param {string[]} opts.noPolygon 不亮國家、只顯示光圈的國家代碼
 * @param {object|null} opts.countries 國界 GeoJSON；null 時不做來源國亮起
 * @param {string} opts.beforeId 來源國亮起要插在哪個圖層之下（讓海纜蓋在上面）
 * @param {boolean} opts.autoplay 是否一建立就開始播放
 * @param {(player: object) => void} opts.onTick 每幀回報 { playing, rate, clock, count, total }
 */
export default function createTrafficFlows(map, {
  flow, nodes, countryCoords, noPolygon, countries, beforeId, autoplay, onTick,
}) {
  const coordOf = {
    src: (code) => countryCoords[code],
    dst: (code) => nodes[code]?.coordinates ?? countryCoords[code],
  };
  const countryGeo = withNumericIds(countries);
  addLayers(map, { countries: countryGeo, nodes, flow }, beforeId);

  const routeOf = createRouteCache(coordOf, flow);
  const countryOf = createCountryLookup(countries && countryGeo, countryCoords, noPolygon);

  let events = [];
  let startTime = 0;
  const player = {
    playing: autoplay,
    rate: flow.playbackRate,
    clock: 0, // 資料時間（ms）
    count: 0, // 本輪已播放的事件數
    total: 0,
  };
  let anim = 0; // 動畫時間（ms），暫停時不前進
  let cursor = 0;
  let loopWaitUntil = null;
  let meteors = [];
  let pulses = [];
  const glowing = new Map(); // country id -> 亮起開始時間

  function spawn(event) {
    player.count += 1;
    const route = routeOf(event.srcCode, event.dstCode);

    // 同一條航線還在前半段飛行中：只累加次數，不重複畫
    const same = meteors.find((m) => (
      m.route === route && m.layer === event.layer && anim - m.start < route.duration / 2
    ));
    if (same) {
      same.count += 1;
      return;
    }
    if (meteors.length >= flow.maxActive) return;

    meteors.push({
      route, layer: event.layer, start: anim, count: 1, arrived: false,
    });
    pulses.push({ coord: route.src, color: flow.srcCountryColor, start: anim });
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
      from = Math.max(0, to - flow.tail);
    } else {
      // 抵達：尾巴收回並淡出
      const k = Math.min(1, (t - route.duration) / flow.fadeDuration);
      to = 1;
      from = Math.max(0, 1 - flow.tail) + Math.min(1, flow.tail) * k;
      opacity = 1 - k;
    }
    if (to - from < 1e-3) return null;
    return {
      type: 'Feature',
      properties: { layer: m.layer, opacity, width: flow.meteorWidth },
      geometry: { type: 'LineString', coordinates: slicePath(route.path, from, to) },
    };
  }

  function updateCountryGlow() {
    glowing.forEach((start, id) => {
      const t = anim - start;
      map.setFeatureState({ source: 'flow-countries', id }, { glow: glowAt(t) });
      if (t >= COUNTRY_GLOW.rise + COUNTRY_GLOW.hold + COUNTRY_GLOW.fade) glowing.delete(id);
    });
  }

  function restart() {
    loopWaitUntil = null;
    cursor = 0;
    player.clock = startTime;
    player.count = 0;
  }

  function advance(dt) {
    anim += dt;

    if (loopWaitUntil !== null) {
      if (anim < loopWaitUntil) return;
      restart();
    }

    player.clock += dt * player.rate;
    while (cursor < events.length && events[cursor].time <= player.clock) {
      spawn(events[cursor]);
      cursor += 1;
    }

    meteors.forEach((m) => {
      if (!m.arrived && anim - m.start >= m.route.duration) {
        Object.assign(m, { arrived: true });
        pulses.push({ coord: m.route.dst, color: flow.dstPulseColor, start: anim });
      }
    });
    meteors = meteors.filter((m) => anim - m.start < m.route.duration + flow.fadeDuration);
    pulses = pulses.filter((p) => anim - p.start < PULSE_DURATION);

    // 一輪播完、畫面清空後，等 loopGap 再從頭重播
    if (events.length && cursor >= events.length && !meteors.length) {
      player.clock = events[events.length - 1].time;
      loopWaitUntil = anim + flow.loopGap;
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

  let rafId = 0;
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
    onTick(player);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return {
    /** 換一批攔截紀錄：清空畫面並從頭播放 */
    setTraffic(records) {
      events = normalizeEvents(records ?? [], coordOf);
      startTime = events[0]?.time ?? 0;
      player.total = events.length;
      meteors = [];
      pulses = [];
      restart();
    },
    play() { player.playing = true; },
    pause() { player.playing = false; },
    toggle() { player.playing = !player.playing; },
    setRate(rate) { player.rate = rate; },
    destroy() {
      cancelAnimationFrame(rafId);
    },
  };
}
