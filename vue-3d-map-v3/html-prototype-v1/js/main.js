import { INITIAL_VIEW, BASE_STYLE } from './config.js';
import { computeCableStatus } from './status.js';
import { setState, subscribe } from './state.js';
import { createCableMap } from './map-layers.js';

const { maplibregl } = window;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function loadData() {
  const [cableIds, incidents, landingPoints] = await Promise.all([
    getJson('./data/cables/index.json'),
    getJson('./data/incidents.json'),
    getJson('./data/landing-points.json'),
  ]);
  const cables = await Promise.all(cableIds.map((id) => getJson(`./data/cables/${id}.json`)));
  return { cables, incidents, landingPoints };
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

const statusMap = computeCableStatus(data.cables, data.incidents);
createCableMap(map, { ...data, statusMap });
bindFilterButtons();
document.getElementById('loading').remove();
