// 元件預設值：都可以透過 CableMap 的 props 覆寫

export const INITIAL_VIEW = {
  // 初始範圍涵蓋歐洲（攻擊來源）到美西（PLCN / SkyCloud 洛杉磯），依容器大小自動縮放
  bounds: [[-12, -12], [245, 62]],
  fitBoundsOptions: { padding: 24 },
  minZoom: 1,
  maxZoom: 12,
};

// 要顯示的路線：台灣 ↔ 香港 / 日本 / 新加坡 / 美國 各一條
// 只畫這些路線用到的區段；陣列為空時顯示全部海纜。
// 其他候選路線（C2C、EAC1、SJC2、FASTER…）見 vue-3d-map-v3/html-prototype/js/config.js
export const VISIBLE_ROUTES = [
  {
    cableId: 'apg',
    from: 'TW',
    to: 'HK',
    segments: ['apg-seg-5', 'apg-seg-1.5', 'apg-seg-6'],
  },
  {
    cableId: 'apg',
    from: 'TW',
    to: 'JP',
    segments: [
      'apg-seg-5', 'apg-seg-1.4', 'apg-seg-1.3', 'apg-seg-1.2', 'apg-seg-2.1', 'apg-seg-2.2',
    ],
  },
  {
    cableId: 'apg',
    from: 'TW',
    to: 'SG',
    segments: [
      'apg-seg-5', 'apg-seg-1.5', 'apg-seg-1.6', 'apg-seg-1.7', 'apg-seg-1.8+9',
      'apg-seg-9-SG-Landing',
    ],
  },
  {
    cableId: 'plcn',
    from: 'TW',
    to: 'US',
    segments: ['plcn-seg-2', 'plcn-pacific-trunk-west', 'plcn-pacific-trunk-east'],
  },
];

// SkyCloud 節點位置（流量的目的地），對應攔截紀錄的 source_node_country
export const SKYCLOUD_NODES = {
  TW: { name: 'SkyCloud 台北', coordinates: [121.5654, 25.033] },
  HK: { name: 'SkyCloud 香港', coordinates: [114.1694, 22.3193] },
  JP: { name: 'SkyCloud 東京', coordinates: [139.6917, 35.6895] },
  SG: { name: 'SkyCloud 新加坡', coordinates: [103.8198, 1.3521] },
  // 經度 +360，與 PLCN 美國端（已用 unwrapLongitudes 展開）落在同一個世界副本
  US: { name: 'SkyCloud 洛杉磯', coordinates: [-118.2437 + 360, 34.0522] },
};

// 攻擊來源國的代表座標（國家中心或首都），對應攔截紀錄的 country_code
// 不在表內的國家會被略過，並在 console 提示
export const COUNTRY_COORDS = {
  AU: [133.8, -25.3],
  BE: [4.35, 50.85],
  BG: [23.32, 42.7],
  BR: [-47.9, -15.8],
  CA: [-106.3, 56.1],
  CH: [8.23, 46.8],
  CL: [-70.67, -33.45],
  CN: [104.2, 35.9],
  DE: [10.45, 51.17],
  ES: [-3.7, 40.42],
  FR: [2.35, 48.86],
  GB: [-1.5, 52.5],
  HK: [114.17, 22.32],
  ID: [113.9, -0.79],
  IL: [34.85, 31.05],
  IN: [78.96, 20.6],
  IT: [12.5, 41.9],
  JP: [138.25, 36.2],
  KR: [127.77, 35.9],
  LT: [23.9, 55.17],
  NL: [5.29, 52.13],
  PK: [69.35, 30.38],
  QA: [51.18, 25.35],
  SC: [55.45, -4.62],
  SE: [18.64, 60.13],
  SG: [103.82, 1.35],
  TR: [35.24, 38.96],
  TW: [120.96, 23.7],
  US: [-98.58, 39.83],
};

// 110m 國界沒有這些國家／地區的多邊形，代表點會落到鄰國（SG → 馬來西亞、HK → 中國），
// 所以不亮國家、只顯示光圈
export const NO_COUNTRY_POLYGON = ['SG', 'HK', 'SC'];

export const FLOW = {
  playbackRate: 600, // 播放倍速：1 秒 = 資料中的 10 分鐘
  rates: [60, 600, 3600],
  loopGap: 2000, // 播完一輪後等多久重播（ms）
  speedKmPerSec: 6000, // 流星飛行速度，不受距離長短影響
  minDuration: 700, // 再短的距離也至少飛這麼久（ms），否則看不見
  maxDuration: 3000,
  tail: 0.35, // 尾巴長度（占整條航線的比例）
  fadeDuration: 500, // 抵達後尾巴收回並淡出（ms）
  maxActive: 200, // 同時在飛的流星上限，超過的事件只計數不畫
  meteorWidth: 1.2, // 流星寬度（px）
  color: {
    L7: '#7df9ff',
    L4: '#ffb347',
  },
  srcCountryColor: '#1998a8', // 來源國亮起
  dstPulseColor: '#817ed4', // 抵達節點的光圈
};

// 狀態顏色（與 CableMap.vue 的 CSS 變數一致）
export const STATUS_COLOR = {
  disconnected: '#ff3b3b',
  partial_disconnected: '#ffa31a',
};

// 設備類型顏色：BMH 登陸站、BU 分歧單元、AC 其他
export const EQUIPMENT_COLOR = {
  BMH: '#ffffff',
  BU: '#c9a7ff',
  AC: '#7fd3ff',
};

// 介面文字：接 vue-i18n 時，把 $t(...) 的結果以 labels prop 傳入即可
export const LABELS = {
  loading: '載入中…',
  loadFailed: '地圖載入失敗',
  filter: {
    all: '全部',
    normal: '正常',
    abnormal: '異常',
  },
  status: {
    normal: '正常',
    notice: '公告',
    partial_disconnected: '部分中斷',
    disconnected: '中斷',
  },
  equipment: {
    BMH: '登陸站',
    BU: '分歧單元',
    AC: '設備',
  },
  landingPoint: '登陸點',
  segment: '區段',
  noIncident: '此區段目前無進行中事件',
  unlocatedIncidents: '本海纜其他事件（未標明區段）',
  untitledIncident: '（未命名事件）',
  occurredAt: '發生',
  repairAt: '預計修復',
  play: '播放',
  pause: '暫停',
  speed: '播放倍速',
  blocked: '已攔截',
};

/** 一層一層合併設定（陣列與非物件值直接覆蓋） */
export function mergeDeep(base, override) {
  if (!override) return base;
  const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
  return Object.keys(override).reduce((acc, key) => ({
    ...acc,
    [key]: isObject(base[key]) && isObject(override[key])
      ? mergeDeep(base[key], override[key])
      : override[key],
  }), { ...base });
}
