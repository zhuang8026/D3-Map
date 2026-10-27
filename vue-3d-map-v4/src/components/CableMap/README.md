# CableMap 元件

海纜狀態地圖，加上攔截流量的流星動畫。由 `3d-map-v4` 移植成 Vue 3 元件。

- Vue 3.5、`<script setup>`、JavaScript（不需要 TypeScript）、Less
- 程式碼符合 Airbnb ESLint 規則
- 不使用 Vite 專屬語法，Vue CLI 5 / webpack 5 可以直接使用

## 檔案

```
CableMap/
  CableMap.vue          主元件：建立地圖、處理生命週期、對外 props / emits / expose
  CableMapFilter.vue    全部 / 正常 / 異常
  CableMapPlayback.vue  播放 / 暫停、倍速、時間、已攔截次數
  cableLayers.js        海纜圖層與 hover / 點擊互動（不依賴 Vue）
  trafficFlows.js       流星動畫（不依賴 Vue）
  utils/
    defaults.js         預設路線、SkyCloud 節點、國家座標、流星參數、介面文字
    baseStyle.js        深色底圖（OpenFreeMap）
    geo.js status.js popup.js   純函式
```

## 放進 cdn_frontend_vue

1. 把整個 `CableMap/` 資料夾複製到專案中，例如 `src/core/components/CableMap/`。
2. 安裝 MapLibre（`@vueuse/core` 專案已經有了）：

   ```sh
   yarn add maplibre-gl@5.6.0
   ```

3. 把國界資料複製到 `public/cable-map/countries-110m.geo.json`。它是來源國亮起用的；不放的話，來源國只會顯示光圈。
4. 在頁面中使用：

   ```vue
   <script setup>
   import { markRaw, onMounted, shallowRef } from 'vue';
   import CableMap from '@/core/components/CableMap/CableMap.vue';

   const data = shallowRef(null);

   onMounted(async () => {
     // 換成專案自己的 API；路徑要加 BASE_URL，部署在子路徑時才不會 404
     const countries = await fetch(`${process.env.BASE_URL}cable-map/countries-110m.geo.json`)
       .then((res) => res.json());
     const { cables, incidents, landingPoints, traffic } = await fetchCableMapData();
     data.value = markRaw({ cables, incidents, landingPoints, traffic, countries });
   });
   </script>

   <template>
     <!-- 元件會填滿父層，父層一定要有高度 -->
     <div style="height: 600px">
       <CableMap
         v-if="data"
         :cables="data.cables"
         :incidents="data.incidents"
         :landing-points="data.landingPoints"
         :traffic="data.traffic"
         :countries="data.countries"
       />
     </div>
   </template>
   ```

## Props

| Prop | 型別 | 預設 | 說明 |
|---|---|---|---|
| `cables` | Array | 必填 | 海纜：`[{ id, name, color, segments: [{ id, coordinates }], equipments }]` |
| `incidents` | Array | `[]` | 事件：`[{ cableid, segment, status, title, date, reparing_at, resolved_at }]` |
| `landingPoints` | Array | `[]` | 登陸點：`[{ id, name, coordinates }]` |
| `traffic` | Array | `[]` | 攔截紀錄：`[{ timestamp, country_code, source_node_country, block_layer }]` |
| `countries` | Object | `null` | 國界 GeoJSON；`null` 時不做來源國亮起 |
| `visibleRoutes` | Array | 4 條路線 | 只畫這些路線用到的區段；`[]` 顯示全部海纜 |
| `nodes` | Object | 5 個節點 | SkyCloud 節點 `{ TW: { name, coordinates } }` |
| `countryCoords` | Object | 29 國 | 來源國代表座標 `{ US: [lng, lat] }` |
| `noCountryPolygon` | Array | `['SG','HK','SC']` | 不亮國家、只顯示光圈的國家 |
| `flowOptions` | Object | `{}` | 覆寫流星參數（見 `defaults.js` 的 `FLOW`） |
| `labels` | Object | `{}` | 覆寫介面文字（見 `defaults.js` 的 `LABELS`） |
| `mapStyle` | Object / String | OpenFreeMap 深色 | MapLibre style |
| `initialView` | Object | 歐洲到美西 | MapLibre 初始視角（`center` / `zoom` 或 `bounds`） |
| `timeZone` | String | `'Asia/Taipei'` | 播放列時間的時區 |
| `autoplay` | Boolean | `true` | 載入後自動播放 |
| `showTraffic` | Boolean | `true` | 是否顯示流量動畫 |
| `showControls` | Boolean | `true` | 是否顯示篩選列與播放列 |
| `filter` | String | `'all'` | 狀態篩選，可以用 `v-model:filter` |

`flowOptions`、`mapStyle`、`initialView`、`showTraffic`、`nodes`、`countryCoords`、`countries` **只在建立地圖時讀取**。之後要更改，請用 `:key` 讓元件重新建立。

## Emits / 對外方法

- `@ready(map)`：地圖與圖層都準備好了
- `@error(err)`：MapLibre 載入或初始化失敗，例如瀏覽器不支援 WebGL 2
- `@select-cable(cableId | null)`：選取或取消選取海纜
- `@update:filter(value)`
- `ref` 可以呼叫 `play()`、`pause()`、`toggle()`、`setRate(n)`、`getMap()`

## 注意事項

- **更新資料要換新陣列。** 元件為了效能用 `toRaw` 讀資料，原地 `push` 或修改元素不會觸發更新。外層請用 `shallowRef` 加 `markRaw` 存放，不要用 `ref` / `reactive` 深層代理上萬個座標點。
- **MapLibre 是動態載入的**，只有元件掛載時才會下載（約 940 KB，gzip 後 256 KB）。單元測試環境 mount 父元件時不會載入 WebGL，元件只會觸發 `@error`。
- **卸載時會完整清除**，包括兩個 `requestAnimationFrame` 迴圈、`keydown` 監聽、Popup 和 `map.remove()`。在 SPA 裡切換路由也不會留下殘留。
- **容器大小改變時會自動 `map.resize()`**，所以可以放進 grid-layout-plus 的卡片。hover 提示用相對容器的座標，放在有 `transform` 的祖先裡也不會跑位。
- **樣式只作用在元件內部。** 顏色變數定義在 `.cable-map` 上，MapLibre Popup 的覆寫用 `:deep()`，不會影響專案其他地方。
- **多語系：** 把 `$t(...)` 的結果組成物件傳給 `labels`，只需要傳想覆寫的鍵：

  ```vue
  <CableMap :labels="{ filter: { all: $t('cableMap.all') }, blocked: $t('cableMap.blocked') }" />
  ```

- **隱藏 L4 流量**（例如 `l4off` 模式）：由外層先過濾，再傳入 `traffic`：

  ```js
  traffic.filter((r) => r.block_layer !== 'L4')
  ```

- **離線或內網環境：** 預設底圖的圖磚和字型來自 `tiles.openfreemap.org`。連不到外網時，請用 `mapStyle` 傳入自架的 style（例如 PMTiles 加上自架字型）。
- **瀏覽器需求：** MapLibre v5 需要 WebGL 2。如果有設定 CSP，要允許 `worker-src blob:`。
