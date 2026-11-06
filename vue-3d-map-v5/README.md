# vue-3d-map-v5

把根目錄的靜態版海纜與流量地圖（MapLibre）改寫成 Vue 3 元件 `CableMap`。

- Vue 3.5 + JavaScript + Less，元件一律用 `<script setup>`
- 用 Vue CLI 5 + webpack 5 建置，工具鏈版本對齊 `cdn_frontend_vue`
- 元件只透過 props / emit 傳資料，不直接呼叫 API，也不讀寫 store

## 執行

```sh
yarn install
yarn serve       # http://localhost:8080/
yarn build
yarn test:unit
yarn lint
```

`.yarnrc` 設了 `ignore-engines true`，原因是 `@vue/test-utils` 間接依賴的 `nopt@10` 要求 Node ≥ 22.22。

## 結構

```
src/
  App.vue                 示範頁：載入資料後以 props 傳給 CableMap
  api/mapData.js          示範用的資料載入（讀 public/data，TopoJSON → GeoJSON）
  components/CableMap/    ← 搬移時複製整個資料夾
    index.js              對外入口（default export CableMap，另匯出常數）
    CableMap.vue          主元件：地圖、圖層、滑鼠互動、Popup
    MapFilter.vue         狀態篩選（全部 / 正常 / 異常）
    PlaybackBar.vue       播放控制列（播放 / 暫停、倍速、L7 / L4 勾選）
    HoverTip.vue          hover 提示
    CablePopup.vue        海纜區段 Popup 內容
    PointPopup.vue        登陸點 / 設備 Popup 內容
    StatusBadge.vue       狀態標籤
    composables/useSyncedProp.js   可選的 v-model
    lib/                  不依賴 Vue 的邏輯
      config.js           預設路線、節點、國家座標、底圖、流星參數
      cable-layers.js     海纜圖層、篩選與高亮、斷線呼吸動畫
      flow-player.js      流星播放器（建立 / 更新 / destroy）
      flow-events.js      流量紀錄整理、航線快取、來源國查詢
      geo.js status.js routes.js format.js   純函式
    styles/variables.less 配色
public/data/              示範資料（複製自根目錄 data/）
tests/unit/               mocha + chai 單元測試
```

## CableMap 用法

```vue
<CableMap
  v-model:filter="filter"
  :cables="cables"
  :incidents="incidents"
  :landing-points="landingPoints"
  :traffic="traffic"
  :countries="countries"
  :loading="loading"
  @select="onSelect"
/>
```

父元件要給 CableMap 一個有高度的容器，它會撐滿容器。

### Props

| Prop | 型別 | 說明 |
|---|---|---|
| `cables` | Array | 海纜：`{ id, name, color, segments: [{ id, coordinates }], equipments }` |
| `incidents` | Array | 海纜事件：`{ cableid, segment, status, title, date, reparing_at, resolved_at }` |
| `landingPoints` | Array | 登陸點：`{ name, coordinates }` |
| `traffic` | Array | 攔截紀錄：`{ timestamp, country_code, source_node_country, block_layer }` |
| `countries` | Object | 國界 GeoJSON FeatureCollection，用來讓來源國亮起；給 `null` 就不亮國家 |
| `loading` | Boolean | 父元件還在載入時顯示「載入中」 |
| `visibleRoutes` | Array | 要顯示的路線，預設是 `config.js` 的 `VISIBLE_ROUTES`；給空陣列就顯示全部海纜 |
| `nodes` / `countryCoords` | Object | SkyCloud 節點 / 國家代表座標 |
| `mapStyle` / `initialView` | Object | 底圖 style / 初始視角，只在建立地圖時讀取 |
| `controls` | Boolean | 是否顯示內建的篩選與播放控制列（預設 `true`） |
| `filter` | String | `'all'` / `'normal'` / `'abnormal'`（可選的 v-model） |
| `playing` | Boolean | 是否播放（可選的 v-model） |
| `playbackRate` | Number | 播放倍速（可選的 v-model） |
| `enabledLayers` | Array | 要顯示的層級，例如 `['L7', 'L4']`（可選的 v-model） |

資料 props 可以先給空陣列，資料到了再換成新的陣列，元件會自動更新圖層。換掉 `traffic` 會讓流星從頭播放。元件只在 props 換成新的參考時才更新，不會偵測陣列內部的修改。資料量大時，建議父元件用 `shallowRef` 或 `Object.freeze` 存放。

「可選的 v-model」是指：有綁 `v-model:xxx` 時由父元件控制；沒綁時元件自己保存狀態。兩種情況都會 emit `update:xxx`。

### Events

| Event | 參數 | 說明 |
|---|---|---|
| `select` | `cableId \| null` | 選取的海纜改變 |
| `progress` | `{ playing, clock, count, total }` | 播放進度；時鐘每分鐘（資料時間）才更新一次，不是每幀觸發 |
| `flow-ready` | `{ total, skippedCodes }` | 流量資料整理完成；`skippedCodes` 是查不到座標而被略過的國家代碼 |
| `map-load` | `map` | MapLibre 地圖載入完成 |
| `error` | `error` | MapLibre 錯誤（例如底圖載入失敗） |

透過 ref 可以呼叫 `getMap()` 取得 MapLibre 實例，或用 `clearSelection()` 關閉 Popup 並取消選取。

## 搬到 cdn_frontend_vue

1. 把 `src/components/CableMap/` 整個資料夾複製過去（資料夾內一律用相對路徑引用，沒有用到 `@/`）。
2. 安裝套件：`yarn add maplibre-gl@5.6.0`。國界資料若是 TopoJSON，還要 `yarn add topojson-client`，在父元件轉成 GeoJSON 後再傳入（參考 `src/api/mapData.js`）。
3. 在頁面元件裡呼叫 API（或從 Vuex 讀資料），再以 props 傳給 `CableMap`。
4. `offline` 模式下連不到 OpenFreeMap，要用 `mapStyle` 傳入內網的底圖 style。國家名稱、節點名稱等文字標籤需要 glyphs，style 裡的 `glyphs` URL 也要改成內網位址。

### 注意事項

- **webpack 版本**：webpack 5.112 起把 `lib/Watching.js` 移走了，`@vue/cli-plugin-unit-mocha`（mochapack）會報錯 `Cannot find module 'webpack/lib/Watching'`。本專案在 `devDependencies` 和 `resolutions` 把 webpack 固定為 `~5.111.0`。若 `cdn_frontend_vue` 的 lockfile 升級到 5.112 以上，也要做同樣的固定。
- **元件測試**：在這套環境中，`@vue/test-utils` 2.5 的 `wrapper.emitted()` 抓不到元件的 emit，所以 `tests/unit` 改用 `onUpdate:*` 監聽器來記錄。
- `CableMap.vue` 會 import `maplibre-gl`，而 jsdom 沒有 WebGL，所以單元測試只涵蓋 `lib/` 和不依賴地圖的子元件。
