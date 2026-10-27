// 地理計算（純函式，不碰 DOM / 地圖）

const RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function toVec([lng, lat]) {
  const l = lng * RAD;
  const p = lat * RAD;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

function toLngLat([x, y, z]) {
  return [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 兩點間的大圓距離（公里） */
export function distanceKm(a, b) {
  return Math.acos(clamp(dot(toVec(a), toVec(b)), -1, 1)) * EARTH_RADIUS_KM;
}

/** 把經度調整到與 prev 相差不超過 180 度 */
function nearLng(lng, prev) {
  return lng + Math.round((prev - lng) / 360) * 360;
}

/**
 * 兩點間的大圓航線，回傳 steps + 1 個點。
 * 經度會保持連續（例如 121 → 241，而不是 121 → -119），
 * 跨越 180 度經線時線條才不會橫跨整張地圖。
 */
export function greatCircle(src, dst, steps = 64) {
  const a = toVec(src);
  const b = toVec(dst);
  const omega = Math.acos(clamp(dot(a, b), -1, 1));
  if (omega < 1e-9) return [src, dst];

  const sin = Math.sin(omega);
  const points = [src];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const k1 = Math.sin((1 - t) * omega) / sin;
    const k2 = Math.sin(t * omega) / sin;
    const [lng, lat] = toLngLat(a.map((v, j) => k1 * v + k2 * b[j]));
    points.push([nearLng(lng, points[i - 1][0]), lat]);
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
  const inner = points.slice(Math.floor(from * last) + 1, Math.ceil(to * last));
  return [at(from), ...inner, at(to)];
}

function inRing([x, y], ring) {
  let inside = false;
  ring.forEach(([xi, yi], i) => {
    const [xj, yj] = ring[i === 0 ? ring.length - 1 : i - 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  });
  return inside;
}

/** 點是否落在 GeoJSON Polygon / MultiPolygon 內（含挖洞） */
export function containsPoint(geometry, point) {
  let polygons = [];
  if (geometry.type === 'Polygon') polygons = [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') polygons = geometry.coordinates;
  return polygons.some(([outer, ...holes]) => (
    inRing(point, outer) && !holes.some((h) => inRing(point, h))
  ));
}

/**
 * 跨越 180 度經線的線段：把西半球的經度加 360，讓線條連續、不橫跨整張地圖。
 */
export function unwrapLongitudes(coordinates) {
  const crossesAntimeridian = coordinates.some(([lng]) => lng > 150)
    || coordinates.some(([lng]) => lng < -100);
  if (!crossesAntimeridian) return coordinates;
  return coordinates.map(([lng, lat]) => [lng < 0 ? lng + 360 : lng, lat]);
}
