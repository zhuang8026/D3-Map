// 海纜狀態判斷（純函式，不碰 DOM / 地圖）

const SEVERITY = {
  normal: 0,
  notice: 1,
  partial_disconnected: 2,
  disconnected: 3,
};

export function isActive(incident) {
  return !incident.resolved_at || incident.resolved_at.trim() === '';
}

export function worse(a, b) {
  return (SEVERITY[b] ?? 0) > (SEVERITY[a] ?? 0) ? b : a;
}

export function isAbnormal(status) {
  return status === 'disconnected' || status === 'partial_disconnected';
}

/**
 * 計算每條海纜、每個區段的狀態。
 * 事件的 segment 對不到該海纜任何區段（空字串或資料錯誤）時，只記在海纜層級（unlocated），
 * 不改變任何區段的顏色，避免整條海纜被誤標為中斷。
 *
 * @returns {Map<string, {
 *   status: string,
 *   unlocated: object[],
 *   segments: Map<string, { status: string, incidents: object[] }>
 * }>}
 */
export function computeCableStatus(cables, incidents) {
  const result = new Map();

  for (const cable of cables) {
    const segments = new Map(
      cable.segments.map((s) => [s.id, { status: 'normal', incidents: [] }]),
    );
    result.set(cable.id, { status: 'normal', unlocated: [], segments });
  }

  for (const incident of incidents.filter(isActive)) {
    const entry = result.get(incident.cableid);
    if (!entry) continue;

    entry.status = worse(entry.status, incident.status);

    const seg = entry.segments.get(incident.segment);
    if (seg) {
      seg.incidents.push(incident);
      seg.status = worse(seg.status, incident.status);
    } else {
      entry.unlocated.push(incident);
    }
  }

  return result;
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
