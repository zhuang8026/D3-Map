// 地理計算（純函式，不碰 DOM / 地圖）

const RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

function toVec([lng, lat]) {
  const l = lng * RAD;
  const p = lat * RAD;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

function toLngLat([x, y, z]) {
  return [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD];
}

/** 兩點間的大圓距離（公里） */
export function distanceKm(a, b) {
  const [x1, y1, z1] = toVec(a);
  const [x2, y2, z2] = toVec(b);
  const dot = Math.min(1, Math.max(-1, x1 * x2 + y1 * y2 + z1 * z2));
  return Math.acos(dot) * EARTH_RADIUS_KM;
}

/**
 * 兩點間的大圓航線，回傳 steps + 1 個點。
 * 經度會保持連續（例如 121 → 241，而不是 121 → -119），
 * 跨越 180 度經線時線條才不會橫跨整張地圖。
 */
export function greatCircle(src, dst, steps = 64) {
  const a = toVec(src);
  const b = toVec(dst);
  const omega = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  if (omega < 1e-9) return [src, dst];

  const sin = Math.sin(omega);
  const points = [];
  let prevLng = src[0];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k1 = Math.sin((1 - t) * omega) / sin;
    const k2 = Math.sin(t * omega) / sin;
    let [lng, lat] = toLngLat([k1 * a[0] + k2 * b[0], k1 * a[1] + k2 * b[1], k1 * a[2] + k2 * b[2]]);
    while (lng - prevLng > 180) lng -= 360;
    while (lng - prevLng < -180) lng += 360;
    prevLng = lng;
    points.push([lng, lat]);
  }
  return points;
}

/** 取折線上 [from, to]（0..1，依點的索引比例）之間的片段 */
export function slicePath(points, from, to) {
  const last = points.length - 1;
  const at = (t) => {
    const f = t * last;
    const i = Math.min(Math.floor(f), last - 1);
    const r = f - i;
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    return [x1 + (x2 - x1) * r, y1 + (y2 - y1) * r];
  };
  const start = at(from);
  const end = at(to);
  const inner = points.slice(Math.floor(from * last) + 1, Math.ceil(to * last));
  return [start, ...inner, end];
}

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 點是否落在 GeoJSON Polygon / MultiPolygon 內（含挖洞） */
export function containsPoint(geometry, point) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates
    : [];
  return polygons.some(([outer, ...holes]) => inRing(point, outer) && !holes.some((h) => inRing(point, h)));
}
