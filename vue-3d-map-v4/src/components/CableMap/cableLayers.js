// 海纜圖層與地圖互動：光暈、hover 高亮、點擊選取、篩選
// 不依賴 Vue：狀態由 CableMap.vue 持有，透過 getState / setState / onTip 溝通

import { STATUS_COLOR, EQUIPMENT_COLOR } from './utils/defaults';
import { unwrapLongitudes } from './utils/geo';
import { isAbnormal } from './utils/status';
import { cablePopupHtml, pointPopupHtml } from './utils/popup';

const ID = ['get', 'cableId'];
const POINT_LAYERS = ['landing-points', 'equipments'];

// ---------- GeoJSON ----------

function buildCableFeatures(cables, statusMap) {
  return {
    type: 'FeatureCollection',
    features: cables.flatMap((cable) => cable.segments
      .filter((segment) => !segment.hidden && segment.coordinates.length >= 2)
      .map((segment) => {
        const seg = statusMap.get(cable.id).segments.get(segment.id);
        const baseColor = segment.color || cable.color || '#cccccc';
        return {
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
        };
      })),
  };
}

function buildEquipmentFeatures(cables) {
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

function addLayers(map) {
  const empty = { type: 'FeatureCollection', features: [] };
  map.addSource('cables', { type: 'geojson', data: empty });
  map.addSource('equipments', { type: 'geojson', data: empty });
  map.addSource('landing-points', { type: 'geojson', data: empty });

  // 斷線光暈（寬度與模糊由呼吸動畫控制）
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

// ---------- 依狀態更新圖層（篩選 / 高亮 / 淡化） ----------

function statusFilterExpr(filter, selectedId) {
  let byStatus = true;
  if (filter === 'normal') byStatus = ['!', ['get', 'abnormal']];
  if (filter === 'abnormal') byStatus = ['get', 'abnormal'];
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

// ---------- 對外 ----------

/**
 * 建立海纜圖層與互動。
 * @param {import('maplibre-gl').Map} map 已觸發 load 的地圖
 * @param {object} maplibregl maplibre-gl 模組（動態載入，所以由外部傳入）
 * @param {object} opts
 * @param {() => object} opts.getState 讀取 { filter, hoveredCableId, selectedCableId }
 * @param {(patch: object) => void} opts.setState 更新上述狀態
 * @param {(tip: object | null) => void} opts.onTip hover 提示：{ x, y, name, sub } 或 null，
 *   x / y 是相對地圖容器左上角的像素
 * @param {() => object} opts.getLabels 讀取目前的介面文字
 * @returns {{ setData: Function, applyState: Function, destroy: Function }}
 */
export default function createCableLayers(map, maplibregl, {
  getState, setState, onTip, getLabels,
}) {
  addLayers(map);

  let statusMap = new Map();
  const canvas = map.getCanvas();
  const popup = new maplibregl.Popup({
    closeButton: true, closeOnClick: false, maxWidth: '340px', offset: 10,
  });

  // 用相對地圖容器的座標：放在有 transform 的祖先裡（例如 grid-layout-plus 的卡片）
  // position: fixed 會失準
  const tipAt = (e, name, sub) => onTip({
    x: e.point.x, y: e.point.y, name, sub,
  });
  const pointAt = (e) => map.queryRenderedFeatures(e.point, { layers: POINT_LAYERS })[0];
  const cableAt = (e) => map.queryRenderedFeatures(e.point, { layers: ['cables-hit'] })[0];

  const onMouseMove = (e) => {
    const point = pointAt(e);
    if (point) {
      canvas.style.cursor = 'pointer';
      setState({ hoveredCableId: point.properties.cableId ?? null });
      tipAt(e, point.properties.name, point.properties.cableName);
      return;
    }

    const cable = cableAt(e);
    if (cable) {
      const { cableId, cableName, segmentId } = cable.properties;
      canvas.style.cursor = 'pointer';
      setState({ hoveredCableId: cableId });
      tipAt(e, cableName, segmentId);
      return;
    }

    canvas.style.cursor = '';
    setState({ hoveredCableId: null });
    onTip(null);
  };

  const onMouseLeave = () => {
    setState({ hoveredCableId: null });
    onTip(null);
  };

  const onClick = (e) => {
    onTip(null);
    const labels = getLabels();

    const point = pointAt(e);
    if (point) {
      popup.setLngLat(point.geometry.coordinates)
        .setHTML(pointPopupHtml(point.properties, labels))
        .addTo(map);
      setState({ selectedCableId: point.properties.cableId ?? null });
      return;
    }

    const cable = cableAt(e);
    if (cable) {
      const { cableId, cableName, segmentId } = cable.properties;
      const entry = statusMap.get(cableId);
      const seg = entry.segments.get(segmentId);
      popup
        .setLngLat(e.lngLat)
        .setHTML(cablePopupHtml({
          cableName,
          segmentId,
          segmentStatus: seg.status,
          incidents: seg.incidents,
          unlocated: entry.unlocated,
        }, labels))
        .addTo(map);
      setState({ selectedCableId: cableId });
      return;
    }

    // 點空白處：取消選取
    popup.remove();
    setState({ selectedCableId: null });
  };

  // 關閉 Popup（含 × 按鈕）即取消選取；切換到另一條海纜時會先觸發 close，再設定新的選取
  const onPopupClose = () => setState({ selectedCableId: null });

  const onKeyDown = (e) => {
    if (e.key !== 'Escape') return;
    popup.remove();
    setState({ selectedCableId: null });
  };

  map.on('mousemove', onMouseMove);
  map.on('click', onClick);
  canvas.addEventListener('mouseleave', onMouseLeave);
  popup.on('close', onPopupClose);
  window.addEventListener('keydown', onKeyDown);

  // 斷線光暈呼吸動畫（只動寬度與模糊，透明度留給淡化效果）
  let rafId = 0;
  let last = 0;
  const tick = (t) => {
    if (t - last > 33) { // 約 30fps
      last = t;
      const p = (Math.sin(t / 450) + 1) / 2; // 0..1
      map.setPaintProperty('cables-glow', 'line-width', 8 + p * 8);
      map.setPaintProperty('cables-glow', 'line-blur', 6 + p * 6);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  applyState(map, getState());

  return {
    /** 更新海纜資料（篩選後的 cables、landingPoints，以及 computeCableStatus 的結果） */
    setData(data) {
      statusMap = data.statusMap;
      map.getSource('cables').setData(buildCableFeatures(data.cables, data.statusMap));
      map.getSource('equipments').setData(buildEquipmentFeatures(data.cables));
      map.getSource('landing-points').setData(buildLandingFeatures(data.landingPoints));
    },
    applyState(state) {
      applyState(map, state);
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      map.off('mousemove', onMouseMove);
      map.off('click', onClick);
      popup.off('close', onPopupClose);
      popup.remove();
    },
  };
}
