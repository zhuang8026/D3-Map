// 地圖與視覺相關常數

export const INITIAL_VIEW = {
  center: [121, 23.5],
  zoom: 4.2,
  minZoom: 2,
  maxZoom: 12,
};

// 要顯示的路線：台灣 ↔ 香港 / 日本 / 新加坡 / 美國 各一條
// 只畫這些路線用到的區段；取消註解即可加回其他路線。
// 若整個陣列為空，則顯示全部海纜。
export const VISIBLE_ROUTES = [
  // ---- 台灣 ↔ 香港 ----
  { cableId: 'apg', from: 'TW', to: 'HK', segments: ['apg-seg-5', 'apg-seg-1.5', 'apg-seg-6'] },
  // { cableId: 'c2c', from: 'TW', to: 'HK', segments: ['c2c-seg-2b', 'c2c-seg-2a'] },
  // { cableId: 'c2c', from: 'TW', to: 'HK', segments: ['c2c-seg-2c', 'c2c-seg-2a'] },
  // { cableId: 'eac1', from: 'TW', to: 'HK', segments: ['eac1-seg-e-Pali-Landing', 'eac1-seg-e', 'eac1-seg-d'] },
  // { cableId: 'frnal-nacs', from: 'TW', to: 'HK', segments: ['nacs-seg-2', 'nacs-seg-hj-hk'] },
  // { cableId: 'sjc2', from: 'TW', to: 'HK', segments: ['sjc2-seg-5a', 'sjc2-seg-Unknown-BU4A-BU3', 'sjc2-seg-4'] },

  // ---- 台灣 ↔ 日本 ----
  { cableId: 'apg', from: 'TW', to: 'JP', segments: ['apg-seg-5', 'apg-seg-1.4', 'apg-seg-1.3', 'apg-seg-1.2', 'apg-seg-2.1', 'apg-seg-2.2'] },
  // { cableId: 'apcn2', from: 'TW', to: 'JP', segments: ['apcn2-seg-6'] },
  // { cableId: 'apricot', from: 'TW', to: 'JP', segments: ['apricot-seg-6', 'apricot-id-19'] },
  // { cableId: 'eac1', from: 'TW', to: 'JP', segments: ['eac1-seg-b-Pali-Landing', 'eac1-seg-b', 'eac1-seg-a'] },
  // { cableId: 'faster', from: 'TW', to: 'JP', segments: ['faster-seg-5+6', 'faster-seg-3', 'faster-seg-2'] },
  // { cableId: 'frnal-nacs', from: 'TW', to: 'JP', segments: ['nacs-seg-1', 'nacs-seg-hj-jp'] },
  // { cableId: 'ncp', from: 'TW', to: 'JP', segments: ['ncp-seg-5', 'ncp-seg-1.4', 'ncp-seg-6'] },
  // { cableId: 'sjc2', from: 'TW', to: 'JP', segments: ['sjc2-seg-5', 'sjc2-seg-Unknown-BU4-BU7', 'sjc2-seg-Unknown-BU7-Tokyo'] },

  // ---- 台灣 ↔ 新加坡 ----
  { cableId: 'apg', from: 'TW', to: 'SG', segments: ['apg-seg-5', 'apg-seg-1.5', 'apg-seg-1.6', 'apg-seg-1.7', 'apg-seg-1.8+9', 'apg-seg-9-SG-Landing'] },
  // { cableId: 'sjc2', from: 'TW', to: 'SG', segments: ['sjc2-seg-5a', 'sjc2-seg-Unknown-BU3-BU1', 'sjc2-seg-Unknown-BU1-SG'] },

  // ---- 台灣 ↔ 美國 ----
  { cableId: 'plcn', from: 'TW', to: 'US', segments: ['plcn-seg-2', 'plcn-pacific-trunk-west', 'plcn-pacific-trunk-east'] },
];

// 狀態顏色（與 css/style.css 的變數一致）
export const STATUS_COLOR = {
  disconnected: '#ff3b3b',
  partial_disconnected: '#ffa31a',
};

export const STATUS_LABEL = {
  normal: '正常',
  notice: '公告',
  partial_disconnected: '部分中斷',
  disconnected: '中斷',
};

// 設備類型顏色：BMH 登陸站、BU 分歧單元、AC 其他
export const EQUIPMENT_COLOR = {
  BMH: '#ffffff',
  BU: '#c9a7ff',
  AC: '#7fd3ff',
};

export const EQUIPMENT_LABEL = {
  BMH: '登陸站',
  BU: '分歧單元',
  AC: '設備',
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
