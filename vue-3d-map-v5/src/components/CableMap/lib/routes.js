// 依 visibleRoutes 篩選要畫的海纜區段、設備與登陸點（純函式）

// 與路線上任一點相距在此距離（度）內的登陸點 / 設備才保留
export const NEAR_ROUTE_DEG = 0.3;

/**
 * 只保留 routes 用到的區段，以及這些區段附近的設備與登陸點。
 * routes 為空時不做任何過濾。
 *
 * @param {{ cables: object[], landingPoints: object[] }} data
 * @param {{ cableId: string, segments: string[] }[]} routes
 */
export function pickRoutes({ cables, landingPoints }, routes) {
  if (!routes || !routes.length) return { cables, landingPoints };

  const wanted = new Map(); // cableId -> Set<segmentId>
  routes.forEach(({ cableId, segments }) => {
    if (!wanted.has(cableId)) wanted.set(cableId, new Set());
    segments.forEach((id) => wanted.get(cableId).add(id));
  });

  const pickedCables = cables
    .filter((c) => wanted.has(c.id))
    .map((c) => ({
      ...c,
      segments: (c.segments ?? []).filter((s) => wanted.get(c.id).has(s.id)),
    }));

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
