// 示範用的資料載入：從 public/data 讀取靜態 JSON。
// 實際專案中改由頁面或 store 呼叫 API，再把結果以 props 傳給 CableMap。

import { feature } from 'topojson-client';

const BASE = `${process.env.BASE_URL}data/`;

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

/** 國界 TopoJSON → GeoJSON FeatureCollection */
export function topologyToCountries(topology) {
  return feature(topology, topology.objects.countries);
}

/**
 * 載入 CableMap 需要的所有資料
 * @returns {Promise<{ cables, incidents, landingPoints, traffic, countries }>}
 */
export async function loadMapData() {
  const [cableIds, incidents, landingPoints, traffic, world] = await Promise.all([
    getJson('cables/index.json'),
    getJson('incidents.json'),
    getJson('landing-points.json'),
    getJson('traffic.json'),
    getJson('countries-110m.json'),
  ]);
  const cables = await Promise.all(cableIds.map((id) => getJson(`cables/${id}.json`)));
  return {
    cables,
    incidents,
    landingPoints,
    traffic,
    countries: topologyToCountries(world),
  };
}
