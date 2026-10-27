# vue-3d-map-v4

把 `3d-map-v4`（海纜狀態 + 流量流星動畫）改寫成 Vue 3 元件，並附上一個 Vite 展示環境。

- 元件本體與整合說明：[`src/components/CableMap/`](src/components/CableMap/README.md)。要放進其他專案時，只需要複製這個資料夾。
- `src/App.vue`：展示外層如何取得資料並傳入 props。
- `public/cable-map/`：展示用的資料（複製自 `3d-map-v4/data`）；國界已經轉成 GeoJSON。

```sh
yarn install
yarn dev               # 展示頁
yarn test              # mocha：geo / status 純函式
yarn lint              # Airbnb ESLint
yarn build:countries   # 從 TopoJSON 重新產生 countries-110m.geo.json
```
