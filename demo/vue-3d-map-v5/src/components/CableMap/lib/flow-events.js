// 流量事件的資料整理（純函式，不碰 DOM / 地圖）

import { flowPath, pathKm, containsPoint } from './geo';

// 110m 國界沒有這些國家／地區的多邊形，代表點會落到鄰國（SG → 馬來西亞、HK → 中國），
// 所以不亮國家、只顯示光圈
export const NO_POLYGON = new Set(['SG', 'HK', 'SC']);

/** 目的地座標：優先用 SkyCloud 節點，不是節點時改用國家座標 */
export function destinationOf(code, nodes, countryCoords) {
  return nodes[code]?.coordinates ?? countryCoords[code];
}

/**
 * traffic 紀錄 → 依時間排序的事件；來源國或目的地查不到座標的紀錄會被略過。
 * @returns {{ events: object[], missing: string[] }} missing 是查不到座標的國家代碼
 */
export function normalizeEvents(records, { nodes, countryCoords }) {
  const missing = new Set();
  const events = [];
  records.forEach((r) => {
    const src = countryCoords[r.country_code];
    const dst = destinationOf(r.source_node_country, nodes, countryCoords);
    if (!src) missing.add(r.country_code);
    if (!dst) missing.add(r.source_node_country);
    if (!src || !dst) return;
    events.push({
      time: Date.parse(r.timestamp),
      srcCode: r.country_code,
      dstCode: r.source_node_country,
      layer: r.block_layer === 'L4' ? 'L4' : 'L7',
    });
  });
  events.sort((a, b) => a.time - b.time);
  return { events, missing: [...missing] };
}

/**
 * 航線快取：同一組「來源 > 目的地」只計算一次路徑與飛行時間。
 * @param {object} flow FLOW 設定（seamLng、speedKmPerSec、minDuration、maxDuration）
 */
export function createRouteCache({ nodes, countryCoords, flow }) {
  const cache = new Map();
  return (srcCode, dstCode) => {
    const key = `${srcCode}>${dstCode}`;
    if (!cache.has(key)) {
      const dst = destinationOf(dstCode, nodes, countryCoords);
      const path = flowPath(countryCoords[srcCode], dst, flow.seamLng);
      const km = pathKm(path);
      const duration = Math.min(
        flow.maxDuration,
        Math.max(flow.minDuration, (km / flow.speedKmPerSec) * 1000),
      );
      // 光圈畫在航線的頭尾，與流星落在同一個經度副本
      cache.set(key, {
        key, src: path[0], dst: path[path.length - 1], path, duration,
      });
    }
    return cache.get(key);
  };
}

/**
 * 來源國代表點落在哪個國家多邊形內；查不到時為 null。
 * countries 的 feature 需帶有數字 id（feature-state 用）。
 */
export function createCountryLookup(countries, countryCoords) {
  const cache = new Map();
  return (code) => {
    if (!cache.has(code)) {
      const point = countryCoords[code];
      const found = NO_POLYGON.has(code) || !point
        ? null
        : countries.features.find((f) => f.geometry && containsPoint(f.geometry, point));
      cache.set(code, found?.id ?? null);
    }
    return cache.get(code);
  };
}
