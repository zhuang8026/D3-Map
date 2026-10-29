# 海纜與流量地圖

以 MapLibre 繪製的靜態網頁（不需建置），合併兩個原型：

- `demo/vue-3d-map-v3/html-prototype`：MapLibre 海纜狀態地圖（區段狀態、事件 Popup、篩選）
- `demo/3d-map-v1/index.html`：D3 流量流星動畫，改用 MapLibre 圖層重寫

流星的資料來自 `data/traffic.json`（攔截紀錄），方向是 `country_code`（攻擊來源國）→ `source_node_country`（SkyCloud 節點）。

## 執行

需要用 HTTP 伺服器開啟，直接雙擊 `index.html` 會被瀏覽器擋掉 `fetch`。在專案根目錄執行：

```sh
python3 -m http.server 5174
# 開啟 http://localhost:5174/
```

## 結構

```
index.html
css/style.css
js/
  main.js        入口：載入資料、建立海纜與流量圖層
  config.js      地圖、海纜路線、SkyCloud 節點、國家座標、流星參數（FLOW）
  map-layers.js  海纜圖層與互動（沿用 v3）
  status.js      海纜狀態計算（沿用 v3）
  state.js       篩選 / hover / 選取狀態（沿用 v3）
  popup.js       Popup HTML（沿用 v3）
  flows.js       流星動畫：排程、航線、來源國亮起、節點光圈
  playback.js    左下角播放控制列（播放 / 暫停、倍速、L7 / L4 勾選）
  geo.js         大圓航線、折線切段、點是否在多邊形內
data/
  cables/ incidents.json landing-points.json cable-metadata.json   海纜資料（沿用 v3）
  traffic.json         攔截紀錄（複製自 demo/data/mock-data.json）
  countries-110m.json  國界 TopoJSON（複製自 demo/3d-map-v1/world-110m.json），只用來讓來源國亮起
demo/                  各版本的原型，見下方「歷史版本」
```

## 流星動畫的規則

- 依 `timestamp` 先後出發；播放倍速預設是 600×，可在控制列切換。一輪播完，等 `FLOW.loopGap` 後重播。
- 航線是大圓航線。飛行時間依距離換算（`FLOW.speedKmPerSec`），並限制在 `minDuration` 到 `maxDuration` 之間。
- 尾巴是固定比例（`FLOW.tail`）；抵達後尾巴收回並淡出。
- L7 是青色，L4 是橘色。控制列的 L7 / L4 勾選框可個別隱藏；取消勾選時畫面上該層級的流星與光圈立即消失，之後的事件仍計入「已攔截」，但不畫。
- 同一條航線的流星還在前半段飛行時，新事件只累加次數，不會重複畫。流星寬度目前固定為 1.2px，不隨次數變粗（`flows.js` 的 `meteorFeature` 保留了依次數加粗的寫法，已註解）。
- 出發時來源國亮起、起點出現光圈；抵達時 SkyCloud 節點出現光圈。
- 來源國與目的地相同的事件（目前只有 L4，例如 CA → CA、US → US）不畫流星，改在目的地顯示較大的橘色光圈，來源國同樣亮起。
- SG、HK、SC 在 110m 國界中沒有自己的多邊形，只顯示光圈、不亮國家。
- 目的地優先使用 `SKYCLOUD_NODES` 的節點座標，不是節點時改用 `COUNTRY_COORDS` 的國家座標。來源國或目的地在兩張表都查不到的紀錄會被略過，console 會列出這些代碼。

## 歷史版本（`demo/`）

| 資料夾 | 內容 |
|---|---|
| `3d-map-v1/` | D3 流量流星動畫原型；`testing-files/` 是 D3 / Three.js 的早期試作 |
| `vue-3d-map-v2/` | Vue 3 + TypeScript + Vite + D3 的世界地圖 |
| `vue-3d-map-v3/` | `html-prototype/`、`html-prototype-v1/`：MapLibre 海纜狀態地圖 |
| `3d-map-v4/` | 首次合併海纜狀態與流量流星的靜態版 |
| `3d-map-v5/` | v4 加上同國 L4 光圈、L7 / L4 勾選框；與根目錄內容相同 |
| `vue-3d-map-v4/` | 把 `3d-map-v4` 包成 Vue 3 元件 `CableMap`（含 ESLint、mocha 測試），尚未包含 v5 的改動 |
| `data/` | `mock-data.json` 與原始攔截紀錄 |
