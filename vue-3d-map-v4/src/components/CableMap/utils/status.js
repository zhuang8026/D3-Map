// 海纜狀態判斷與路線挑選（純函式，不碰 DOM / 地圖）

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
  const result = new Map(cables.map((cable) => [cable.id, {
    status: 'normal',
    unlocated: [],
    segments: new Map(cable.segments.map((s) => [s.id, { status: 'normal', incidents: [] }])),
  }]));

  incidents.filter(isActive).forEach((incident) => {
    const entry = result.get(incident.cableid);
    if (!entry) return;

    entry.status = worse(entry.status, incident.status);

    const seg = entry.segments.get(incident.segment);
    if (seg) {
      seg.incidents.push(incident);
      seg.status = worse(seg.status, incident.status);
    } else {
      entry.unlocated.push(incident);
    }
  });

  return result;
}

// 與路線上任一點相距在此距離（度）內的登陸點 / 設備才保留
const NEAR_ROUTE_DEG = 0.3;

/**
 * 只保留 routes 用到的區段，以及這些區段附近的設備與登陸點。
 * routes 為空時不做任何過濾。
 */
export function pickRoutes({ cables, landingPoints }, routes) {
  if (!routes.length) return { cables, landingPoints };

  const wanted = new Map(); // cableId -> Set<segmentId>
  routes.forEach(({ cableId, segments }) => {
    if (!wanted.has(cableId)) wanted.set(cableId, new Set());
    segments.forEach((id) => wanted.get(cableId).add(id));
  });

  const pickedCables = cables
    .filter((c) => wanted.has(c.id))
    .map((c) => ({ ...c, segments: c.segments.filter((s) => wanted.get(c.id).has(s.id)) }));

  const points = pickedCables.flatMap((c) => c.segments.flatMap((s) => s.coordinates));
  const nearRoute = ([lng, lat]) => points.some(
    ([x, y]) => Math.abs(x - lng) < NEAR_ROUTE_DEG && Math.abs(y - lat) < NEAR_ROUTE_DEG,
  );

  return {
    cables: pickedCables.map((c) => ({
      ...c,
      equipments: (c.equipments ?? []).filter((eq) => nearRoute(eq.coordinate)),
    })),
    landingPoints: landingPoints.filter((p) => nearRoute(p.coordinates)),
  };
}
