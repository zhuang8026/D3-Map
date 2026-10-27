// 把 TopoJSON 國界轉成 GeoJSON，讓元件在執行時不需要 topojson-client
// 用法：yarn build:countries [來源 TopoJSON] [輸出 GeoJSON]

import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const src = process.argv[2] ?? '../demo/world-110m.json';
const out = process.argv[3] ?? 'public/cable-map/countries-110m.geo.json';

const topo = JSON.parse(readFileSync(src, 'utf8'));
const geo = feature(topo, topo.objects.countries);

// 110m 的精度到小數 3 位（約 100 公尺）就足夠，可以把檔案縮小一半以上
const round = (c) => (typeof c[0] === 'number' ? c.map((n) => Math.round(n * 1000) / 1000) : c.map(round));
geo.features = geo.features.map((f, i) => ({
  type: 'Feature',
  id: i, // MapLibre feature-state 需要數字 id
  properties: { name: f.properties.name, iso: f.id },
  geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
}));

writeFileSync(out, JSON.stringify(geo));
console.log(`${geo.features.length} 個國家 → ${out}`);
