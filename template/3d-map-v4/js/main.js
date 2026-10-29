import { INITIAL_VIEW, BASE_STYLE, VISIBLE_ROUTES } from './config.js';
import { computeCableStatus } from './status.js';
import { setState, subscribe } from './state.js';
import { createCableMap } from './map-layers.js';
import { createFlowLayer } from './flows.js';
import { bindPlayback } from './playback.js';

const { maplibregl } = window;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function loadData() {
  const [cableIds, incidents, landingPoints, traffic, world] = await Promise.all([
    getJson('./data/cables/index.json'),
    getJson('./data/incidents.json'),
    getJson('./data/landing-points.json'),
    getJson('./data/traffic.json'),
    getJson('./data/countries-110m.json'),
  ]);
  const cables = await Promise.all(cableIds.map((id) => getJson(`./data/cables/${id}.json`)));
  const countries = window.topojson.feature(world, world.objects.countries);
  return { cables, incidents, landingPoints, traffic, countries };
}

// 與路線上任一點相距在此距離（度）內的登陸點 / 設備才保留
const NEAR_ROUTE_DEG = 0.3;

/**
 * 只保留 VISIBLE_ROUTES 用到的區段，以及這些區段附近的設備與登陸點。
 * VISIBLE_ROUTES 為空時不做任何過濾。
 */
function pickRoutes({ cables, landingPoints, ...rest }, routes) {
  if (!routes.length) return { cables, landingPoints, ...rest };

  const wanted = new Map(); // cableId -> Set<segmentId>
  for (const { cableId, segments } of routes) {
    if (!wanted.has(cableId)) wanted.set(cableId, new Set());
    segments.forEach((id) => wanted.get(cableId).add(id));
  }

  const pickedCables = cables
    .filter((c) => wanted.has(c.id))
    .map((c) => ({ ...c, segments: c.segments.filter((s) => wanted.get(c.id).has(s.id)) }));

  const points = pickedCables.flatMap((c) => c.segments.flatMap((s) => s.coordinates));
  const nearRoute = ([lng, lat]) => points.some(
    ([x, y]) => Math.abs(x - lng) < NEAR_ROUTE_DEG && Math.abs(y - lat) < NEAR_ROUTE_DEG,
  );

  return {
    ...rest,
    cables: pickedCables.map((c) => ({
      ...c,
      equipments: (c.equipments ?? []).filter((eq) => nearRoute(eq.coordinate)),
    })),
    landingPoints: landingPoints.filter((p) => nearRoute(p.coordinates)),
  };
}

function bindFilterButtons() {
  const buttons = document.querySelectorAll('.filter button');
  buttons.forEach((btn) => btn.addEventListener('click', () => setState({ filter: btn.dataset.filter })));
  subscribe(({ filter }) => {
    buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.filter === filter));
  });
}

const map = new maplibregl.Map({
  container: 'map',
  style: BASE_STYLE,
  ...INITIAL_VIEW,
  attributionControl: { compact: true },
});
window.__map = map; // 方便在 DevTools 除錯
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

const [data] = await Promise.all([
  loadData(),
  new Promise((resolve) => map.once('load', resolve)),
]);

const visible = pickRoutes(data, VISIBLE_ROUTES);
const statusMap = computeCableStatus(visible.cables, visible.incidents);
createCableMap(map, { ...visible, statusMap });
// 來源國亮起插在海纜底下，流星與節點畫在最上層
const flows = createFlowLayer(map, data, { beforeId: 'cables-glow' });
bindFilterButtons();
bindPlayback(flows);
document.getElementById('loading').remove();
