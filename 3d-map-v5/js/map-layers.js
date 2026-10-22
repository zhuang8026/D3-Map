// 海纜圖層與地圖互動：光暈、hover 高亮、點擊選取、篩選

import { STATUS_COLOR, EQUIPMENT_COLOR } from './config.js';
import { unwrapLongitudes, isAbnormal } from './status.js';
import { getState, setState, subscribe } from './state.js';
import { hoverTipHtml, cablePopupHtml, pointPopupHtml } from './popup.js';

const { maplibregl } = window;

const CABLE_LAYERS = ['cables-glow', 'cables-halo', 'cables-line', 'cables-dashed'];
const ID = ['get', 'cableId'];

// ---------- GeoJSON ----------

function buildCableFeatures(cables, statusMap) {
  const features = [];
  for (const cable of cables) {
    const cableStatus = statusMap.get(cable.id);
    for (const segment of cable.segments) {
      if (segment.hidden || segment.coordinates.length < 2) continue;
      const seg = cableStatus.segments.get(segment.id);
      const baseColor = segment.color || cable.color || '#cccccc';
      features.push({
        type: 'Feature',
        properties: {
          cableId: cable.id,
          cableName: cable.name,
          segmentId: segment.id,
          status: seg.status,
          abnormal: isAbnormal(seg.status),
          color: STATUS_COLOR[seg.status] ?? baseColor,
          dashed: Boolean(cable.building || segment.building || segment.retired),
        },
        geometry: { type: 'LineString', coordinates: unwrapLongitudes(segment.coordinates) },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

function buildEquipmentFeatures(cables) {
  return {
    type: 'FeatureCollection',
    features: cables.flatMap((cable) => (cable.equipments ?? []).map((eq) => ({
      type: 'Feature',
      properties: { cableId: cable.id, cableName: cable.name, name: eq.name, type: eq.type },
      geometry: { type: 'Point', coordinates: eq.coordinate },
    }))),
  };
}

function buildLandingFeatures(landingPoints) {
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

function addLayers(map, { cables, statusMap, landingPoints }) {
  map.addSource('cables', { type: 'geojson', data: buildCableFeatures(cables, statusMap) });
  map.addSource('equipments', { type: 'geojson', data: buildEquipmentFeatures(cables) });
  map.addSource('landing-points', { type: 'geojson', data: buildLandingFeatures(landingPoints) });

  // 斷線光暈（透明度由動畫控制）
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
    id: 'cables-hit',
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
      'circle-color': ['match', ['get', 'type'], 'BMH', EQUIPMENT_COLOR.BMH, 'BU', EQUIPMENT_COLOR.BU, EQUIPMENT_COLOR.AC],
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

// ---------- 依狀態更新圖層（篩選 / 高亮 / 淡化） ----------

function statusFilterExpr(filter, selectedId) {
  const byStatus = filter === 'normal' ? ['!', ['get', 'abnormal']]
    : filter === 'abnormal' ? ['get', 'abnormal']
    : true;
  // 已選取的海纜不受篩選影響
  return selectedId ? ['any', ['==', ID, selectedId], byStatus] : byStatus;
}

function applyState(map, { filter, hoveredCableId, selectedCableId }) {
  const visible = statusFilterExpr(filter, selectedCableId);
  map.setFilter('cables-glow', ['all', ['==', ['get', 'status'], 'disconnected'], visible]);
  map.setFilter('cables-line', ['all', ['!', ['get', 'dashed']], visible]);
  map.setFilter('cables-dashed', ['all', ['get', 'dashed'], visible]);
  map.setFilter('cables-hit', visible);

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

function startGlowAnimation(map) {
  let last = 0;
  const tick = (t) => {
    if (t - last > 33) { // 約 30fps
      last = t;
      const p = (Math.sin(t / 450) + 1) / 2; // 0..1
      map.setPaintProperty('cables-glow', 'line-width', 8 + p * 8);
      map.setPaintProperty('cables-glow', 'line-blur', 6 + p * 6);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- 滑鼠互動 ----------

function bindInteractions(map, statusMap) {
  const tip = document.getElementById('hover-tip');
  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: '340px', offset: 10 });

  const showTip = (e, html) => {
    tip.innerHTML = html;
    tip.style.left = `${e.originalEvent.clientX}px`;
    tip.style.top = `${e.originalEvent.clientY}px`;
    tip.hidden = false;
  };
  const hideTip = () => { tip.hidden = true; };

  const pointLayers = ['landing-points', 'equipments'];

  map.on('mousemove', (e) => {
    const point = map.queryRenderedFeatures(e.point, { layers: pointLayers })[0];
    if (point) {
      map.getCanvas().style.cursor = 'pointer';
      setState({ hoveredCableId: point.properties.cableId ?? null });
      showTip(e, hoverTipHtml(point.properties.name, point.properties.cableName));
      return;
    }

    const cable = map.queryRenderedFeatures(e.point, { layers: ['cables-hit'] })[0];
    if (cable) {
      const { cableId, cableName, segmentId } = cable.properties;
      map.getCanvas().style.cursor = 'pointer';
      setState({ hoveredCableId: cableId });
      showTip(e, hoverTipHtml(cableName, segmentId));
      return;
    }

    map.getCanvas().style.cursor = '';
    setState({ hoveredCableId: null });
    hideTip();
  });

  map.getCanvas().addEventListener('mouseleave', () => {
    setState({ hoveredCableId: null });
    hideTip();
  });

  map.on('click', (e) => {
    hideTip();

    const point = map.queryRenderedFeatures(e.point, { layers: pointLayers })[0];
    if (point) {
      popup.setLngLat(point.geometry.coordinates).setHTML(pointPopupHtml(point.properties)).addTo(map);
      setState({ selectedCableId: point.properties.cableId ?? null });
      return;
    }

    const cable = map.queryRenderedFeatures(e.point, { layers: ['cables-hit'] })[0];
    if (cable) {
      const { cableId, cableName, segmentId } = cable.properties;
      const seg = statusMap.get(cableId).segments.get(segmentId);
      popup
        .setLngLat(e.lngLat)
        .setHTML(cablePopupHtml({
          cableName,
          segmentId,
          segmentStatus: seg.status,
          incidents: seg.incidents,
          unlocated: statusMap.get(cableId).unlocated,
        }))
        .addTo(map);
      setState({ selectedCableId: cableId });
      return;
    }

    // 點空白處：取消選取
    popup.remove();
    setState({ selectedCableId: null });
  });

  // 關閉 Popup（含 × 按鈕）即取消選取；切換到另一條海纜時會先觸發 close，再設定新的選取
  popup.on('close', () => setState({ selectedCableId: null }));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      popup.remove();
      setState({ selectedCableId: null });
    }
  });
}

// ---------- 對外 ----------

export function createCableMap(map, data) {
  addLayers(map, data);
  applyState(map, getState());
  subscribe((s) => applyState(map, s));
  bindInteractions(map, data.statusMap);
  startGlowAnimation(map);
}
