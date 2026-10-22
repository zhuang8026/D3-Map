# 3d-map-v4：海纜與流量地圖

合併兩個原型：

- `vue-3d-map-v3/html-prototype`：MapLibre 海纜狀態地圖（區段狀態、事件 Popup、篩選）
- `demo/index.html`：D3 流量流星動畫，改用 MapLibre 圖層重寫

流星的資料來自 `data/traffic.json`（攔截紀錄），方向是 `country_code`（攻擊來源國）→ `source_node_country`（SkyCloud 節點）。

## 執行

需要用 HTTP 伺服器開啟，直接雙擊 `index.html` 會被瀏覽器擋掉 `fetch`：

```sh
cd 3d-map-v4
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
  playback.js    左下角播放控制列
  geo.js         大圓航線、折線切段、點是否在多邊形內
data/
  cables/ incidents.json landing-points.json cable-metadata.json   海纜資料（沿用 v3）
  traffic.json         攔截紀錄（複製自 ../data/mock-data.json）
  countries-110m.json  國界 TopoJSON（複製自 demo/world-110m.json），只用來讓來源國亮起
```

## 流星動畫的規則

- 依 `timestamp` 先後出發；播放倍速預設是 600×，可在控制列切換。一輪播完，等 `FLOW.loopGap` 後重播。
- 航線是大圓航線。飛行時間依距離換算（`FLOW.speedKmPerSec`），並限制在 `minDuration` 到 `maxDuration` 之間。
- 尾巴是固定比例（`FLOW.tail`）；抵達後尾巴收回並淡出。
- L7 是青色，L4 是橘色。
- 同一條航線的流星還在前半段飛行時，新事件只累加次數，讓線變粗，不會重複畫。
- 出發時來源國亮起、起點出現光圈；抵達時 SkyCloud 節點出現光圈。
- SG、HK、SC 在 110m 國界中沒有自己的多邊形，只顯示光圈、不亮國家。
- 國家或節點不在 `COUNTRY_COORDS` / `SKYCLOUD_NODES` 裡的紀錄會被略過，console 會列出這些代碼。
