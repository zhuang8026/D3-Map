// 深色底圖：OpenFreeMap（OpenMapTiles schema）
// 圖磚與字型來自外部服務；離線環境請改傳 mapStyle prop（例如自架的 PMTiles）

const BASE_STYLE = {
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

export default BASE_STYLE;
