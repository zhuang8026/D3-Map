// 地圖與視覺相關常數

export const INITIAL_VIEW = {
  // 初始範圍涵蓋歐洲（攻擊來源）到美西（SkyCloud 洛杉磯），依視窗大小自動縮放
  bounds: [[-12, -12], [245, 62]],
  fitBoundsOptions: { padding: 24 },
  minZoom: 1,
  maxZoom: 12,
};

// ---------- 流量流星動畫 ----------

// SkyCloud 節點位置（流量的目的地），對應 traffic.json 的 source_node_country
export const SKYCLOUD_NODES = {
  TW: { name: 'SkyCloud 台北', coordinates: [121.5654, 25.033] },
  HK: { name: 'SkyCloud 香港', coordinates: [114.1694, 22.3193] },
  JP: { name: 'SkyCloud 東京', coordinates: [139.6917, 35.6895] },
  SG: { name: 'SkyCloud 新加坡', coordinates: [103.8198, 1.3521] },
  // 經度 +360：地圖以太平洋為中心，讓洛杉磯落在亞洲右側的世界副本
  US: { name: 'SkyCloud 洛杉磯', coordinates: [-118.2437 + 360, 34.0522] },
};

// 攻擊來源國的代表座標（國家中心或首都），對應 traffic.json 的 country_code
// 不在表內的國家會被略過，並在 console 提示
export const COUNTRY_COORDS = {
  AU: [133.8, -25.3], BE: [4.35, 50.85], BG: [23.32, 42.7], BR: [-47.9, -15.8],
  CA: [-106.3, 56.1], CH: [8.23, 46.8], CL: [-70.67, -33.45], CN: [104.2, 35.9],
  DE: [10.45, 51.17], ES: [-3.7, 40.42], FR: [2.35, 48.86], GB: [-1.5, 52.5],
  HK: [114.17, 22.32], ID: [113.9, -0.79], IL: [34.85, 31.05], IN: [78.96, 20.6],
  IT: [12.5, 41.9], JP: [138.25, 36.2], KR: [127.77, 35.9], LT: [23.9, 55.17],
  NL: [5.29, 52.13], PK: [69.35, 30.38], QA: [51.18, 25.35], SC: [55.45, -4.62],
  SE: [18.64, 60.13], SG: [103.82, 1.35], TR: [35.24, 38.96], TW: [120.96, 23.7],
  US: [-98.58, 39.83],
};

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
  color: {
    L7: '#7df9ff',
    L4: '#ffb347',
  },
  srcCountryColor: '#1998a8', // 來源國亮起
  dstPulseColor: '#817ed4', // 抵達節點的光圈
};

// 深色底圖：OpenFreeMap（OpenMapTiles schema）
export const BASE_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': '#34363c' } },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'fill-color': '#16171b' },
    },
    {
      id: 'admin-county',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      minzoom: 5,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': '#5a5d66', 'line-width': 0.6 },
    },
    {
      id: 'admin-country',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': '#8b8f99', 'line-width': 0.8 },
    },
    {
      id: 'country-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#8b8f99',
        'text-halo-color': '#16171b',
        'text-halo-width': 1,
      },
    },
    // 香港、澳門在 OpenMapTiles 中屬於 city，不在 country 分類內
    {
      id: 'city-label-major',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['all', ['==', ['get', 'class'], 'city'], ['<=', ['get', 'rank'], 2]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
      },
      paint: {
        'text-color': '#6f727b',
        'text-halo-color': '#16171b',
        'text-halo-width': 1,
      },
    },
    {
      id: 'city-label-minor',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 6,
      filter: ['all', ['==', ['get', 'class'], 'city'], ['>', ['get', 'rank'], 2], ['<=', ['get', 'rank'], 8]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
      },
      paint: {
        'text-color': '#6f727b',
        'text-halo-color': '#16171b',
        'text-halo-width': 1,
      },
    },
  ],
};
