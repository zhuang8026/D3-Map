// 海纜圖層：光暈、hover 高亮、篩選、斷線呼吸動畫。
// 不依賴 Vue；滑鼠互動與 Popup 由 CableMap.vue 處理。

import { STATUS_COLOR, EQUIPMENT_COLOR } from './config';
import { unwrapLongitudes, isAbnormal } from './status';

const ID = ['get', 'cableId'];
const emptyCollection = () => ({ type: 'FeatureCollection', features: [] });

/** 可 hover / 點擊的海纜圖層 */
export const CABLE_HIT_LAYER = 'cables-hit';
/** 可 hover / 點擊的點圖層（先查這些，再查海纜） */
export const POINT_LAYERS = ['landing-points', 'equipments'];
/** 最底層的海纜圖層；流量的來源國亮起插在它下面 */
export const CABLE_BOTTOM_LAYER = 'cables-glow';

// ---------- GeoJSON ----------

export function buildCableFeatures(cables, statusMap) {
  const features = cables.flatMap((cable) => {
    const cableStatus = statusMap.get(cable.id);
    return (cable.segments ?? [])
      .filter((segment) => !segment.hidden && segment.coordinates.length >= 2)
      .map((segment) => {
        const { status } = cableStatus.segments.get(segment.id);
        const baseColor = segment.color || cable.color || '#cccccc';
        return {
          type: 'Feature',
          properties: {
            cableId: cable.id,
            cableName: cable.name,
            segmentId: segment.id,
            status,
            abnormal: isAbnormal(status),
            color: STATUS_COLOR[status] ?? baseColor,
            dashed: Boolean(cable.building || segment.building || segment.retired),
          },
          geometry: { type: 'LineString', coordinates: unwrapLongitudes(segment.coordinates) },
        };
      });
  });
  return { type: 'FeatureCollection', features };
}

export function buildEquipmentFeatures(cables) {
  return {
    type: 'FeatureCollection',
    features: cables.flatMap((cable) => (cable.equipments ?? []).map((eq) => ({
      type: 'Feature',
      properties: {
        cableId: cable.id, cableName: cable.name, name: eq.name, type: eq.type,
      },
      geometry: { type: 'Point', coordinates: eq.coordinate },
    }))),
  };
}

export function buildLandingFeatures(landingPoints) {
  return {
    type: 'FeatureCollection',
    features: landingPoints.map((p) => ({
      type: 'Feature',
      properties: { name: p.name },
      geometry: { type: 'Point', coordinates: p.coordinates },
    })),
  };
}

// ---------- 圖層 ----------

/** 建立海纜相關的 source 與圖層（資料先留空，之後用 setCableData 填入） */
export function addCableLayers(map) {
  map.addSource('cables', { type: 'geojson', data: emptyCollection() });
  map.addSource('equipments', { type: 'geojson', data: emptyCollection() });
  map.addSource('landing-points', { type: 'geojson', data: emptyCollection() });

  // 斷線光暈（寬度由呼吸動畫控制，透明度由淡化效果控制）
  map.addLayer({
    id: 'cables-glow',
    type: 'line',
    source: 'cables',
    filter: ['==', ['get', 'status'], 'disconnected'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': STATUS_COLOR.disconnected,
      'line-width': 14,
      'line-blur': 10,
      'line-opacity': 0.4,
    },
  });

  // hover / 選取時的柔光外框
  map.addLayer({
    id: 'cables-halo',
    type: 'line',
    source: 'cables',
    filter: ['==', ID, ''],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 8,
      'line-blur': 4,
      'line-opacity': 0.45,
    },
  });

  // 主線
  map.addLayer({
    id: 'cables-line',
    type: 'line',
    source: 'cables',
    filter: ['!', ['get', 'dashed']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['case', ['get', 'abnormal'], 3, 1.5],
      'line-opacity': 1,
    },
  });

  // 建置中 / 已退役：虛線
  map.addLayer({
    id: 'cables-dashed',
    type: 'line',
    source: 'cables',
    filter: ['get', 'dashed'],
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.5,
      'line-dasharray': [2, 2],
      'line-opacity': 0.7,
    },
  });

  // 隱形的寬線，讓細線也容易 hover / 點擊
  map.addLayer({
    id: CABLE_HIT_LAYER,
    type: 'line',
    source: 'cables',
    paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 14 },
  });

  map.addLayer({
    id: 'equipments',
    type: 'circle',
    source: 'equipments',
    minzoom: 4.5,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4.5, 2.5, 8, 5],
      'circle-color': [
        'match', ['get', 'type'],
        'BMH', EQUIPMENT_COLOR.BMH,
        'BU', EQUIPMENT_COLOR.BU,
        EQUIPMENT_COLOR.AC,
      ],
      'circle-stroke-color': '#16171b',
      'circle-stroke-width': 1,
      'circle-opacity': 1,
      'circle-stroke-opacity': 1,
    },
  });

  map.addLayer({
    id: 'landing-points',
    type: 'circle',
    source: 'landing-points',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 8, 6],
      'circle-color': '#16171b',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
    },
  });

  map.addLayer({
    id: 'landing-labels',
    type: 'symbol',
    source: 'landing-points',
    minzoom: 6,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
    },
    paint: { 'text-color': '#c9cbd1', 'text-halo-color': '#16171b', 'text-halo-width': 1 },
  });
}

/** 更新海纜、設備、登陸點資料 */
export function setCableData(map, { cables, landingPoints, statusMap }) {
  map.getSource('cables').setData(buildCableFeatures(cables, statusMap));
  map.getSource('equipments').setData(buildEquipmentFeatures(cables));
  map.getSource('landing-points').setData(buildLandingFeatures(landingPoints));
}

// ---------- 依狀態更新圖層（篩選 / 高亮 / 淡化） ----------

function statusFilterExpr(filter, selectedId) {
  let byStatus = true;
  if (filter === 'normal') byStatus = ['!', ['get', 'abnormal']];
  else if (filter === 'abnormal') byStatus = ['get', 'abnormal'];
  // 已選取的海纜不受篩選影響
  return selectedId ? ['any', ['==', ID, selectedId], byStatus] : byStatus;
}

/**
 * @param {{ filter: string, hoveredCableId: string|null, selectedCableId: string|null }} state
 */
export function applyCableState(map, { filter, hoveredCableId, selectedCableId }) {
  const visible = statusFilterExpr(filter, selectedCableId);
  map.setFilter('cables-glow', ['all', ['==', ['get', 'status'], 'disconnected'], visible]);
  map.setFilter('cables-line', ['all', ['!', ['get', 'dashed']], visible]);
  map.setFilter('cables-dashed', ['all', ['get', 'dashed'], visible]);
  map.setFilter(CABLE_HIT_LAYER, visible);

  // 柔光外框：hover 與選取的海纜
  const highlighted = [hoveredCableId, selectedCableId].filter(Boolean);
  map.setFilter('cables-halo', ['all', ['in', ID, ['literal', highlighted]], visible]);

  // 淡化其他海纜：有選取時以選取為主，否則以 hover 為主
  const focusId = selectedCableId ?? hoveredCableId;
  const dim = (on, off) => (focusId ? ['case', ['in', ID, ['literal', highlighted]], on, off] : on);
  map.setPaintProperty('cables-glow', 'line-opacity', dim(0.45, 0.06));
  map.setPaintProperty('cables-line', 'line-opacity', dim(1, 0.15));
  map.setPaintProperty('cables-dashed', 'line-opacity', dim(0.9, 0.1));
  map.setPaintProperty('equipments', 'circle-opacity', dim(1, 0.15));
  map.setPaintProperty('equipments', 'circle-stroke-opacity', dim(1, 0.15));
  map.setPaintProperty('cables-halo', 'line-width', selectedCableId ? 9 : 7);
}

// ---------- 斷線光暈呼吸動畫（只動寬度與模糊，透明度留給淡化效果） ----------

/** @returns {() => void} 停止動畫 */
export function startGlowAnimation(map) {
  let last = 0;
  let raf = 0;
  const tick = (t) => {
    if (t - last > 33) { // 約 30fps
      last = t;
      const p = (Math.sin(t / 450) + 1) / 2; // 0..1
      map.setPaintProperty('cables-glow', 'line-width', 8 + p * 8);
      map.setPaintProperty('cables-glow', 'line-blur', 6 + p * 6);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
