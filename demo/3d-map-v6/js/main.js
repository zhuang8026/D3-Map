import { INITIAL_VIEW, BASE_STYLE } from './config.js';
import { createFlowLayer } from './flows.js';
import { bindPlayback } from './playback.js';

const { maplibregl } = window;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function loadData() {
  const [traffic, world] = await Promise.all([
    getJson('./data/traffic.json'),
    getJson('./data/countries-110m.json'),
  ]);
  const countries = window.topojson.feature(world, world.objects.countries);
  return { traffic, countries };
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

const flows = createFlowLayer(map, data);
bindPlayback(flows);
document.getElementById('loading').remove();
