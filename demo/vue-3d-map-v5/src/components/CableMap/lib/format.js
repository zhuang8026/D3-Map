// 顯示用的格式化（純函式）

const pad = (n) => String(n).padStart(2, '0');

/**
 * 時間戳（ms）→ 'YYYY-MM-DD HH:mm'。
 * 資料時間預設以台灣時間（UTC+8）顯示，與 traffic 資料的時區一致。
 */
export function formatClock(ms, offsetHours = 8) {
  const d = new Date(ms + offsetHours * 3600 * 1000);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** ISO 時間字串 → 'YYYY-MM-DD'；空值顯示 '—' */
export function formatDay(iso) {
  return iso ? iso.slice(0, 10) : '—';
}
