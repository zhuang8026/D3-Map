# 3d-map-v6：流量地圖

由 `3d-map-v5` 複製而來，移除了海纜相關的資料與圖層（海纜路線、區段狀態、事件 Popup、狀態篩選、hover 提示、登陸點與設備），只保留流量流星動畫。

流星的資料來自 `data/traffic.json`（攔截紀錄），方向是 `country_code`（攻擊來源國）→ `source_node_country`（SkyCloud 節點）。

## 執行

需要用 HTTP 伺服器開啟，直接雙擊 `index.html` 會被瀏覽器擋掉 `fetch`：

```sh
cd demo/3d-map-v6
python3 -m http.server 5174
# 開啟 http://localhost:5174/
```

## 結構

```
index.html
css/style.css
js/
  main.js        入口：載入資料、建立流量圖層
  config.js      地圖、SkyCloud 節點、國家座標、流星參數（FLOW）、底圖
  flows.js       流星動畫：排程、航線、來源國亮起、節點光圈
  playback.js    左下角播放控制列（播放 / 暫停、倍速、L7 / L4 勾選）
  geo.js         大圓航線、折線切段、點是否在多邊形內
data/
  traffic.json         攔截紀錄
  countries-110m.json  國界 TopoJSON，只用來讓來源國亮起
```

## 流星動畫的規則

- 依 `timestamp` 先後出發；播放倍速預設是 600×，可在控制列切換。一輪播完，等 `FLOW.loopGap` 後重播。
- 航線是大圓航線。飛行時間依距離換算（`FLOW.speedKmPerSec`），並限制在 `minDuration` 到 `maxDuration` 之間。
- 尾巴是固定比例（`FLOW.tail`）；抵達後尾巴收回並淡出。
- L7 是青色，L4 是橘色。控制列的 L7 / L4 勾選框可個別隱藏；取消勾選時畫面上該層級的流星與光圈立即消失，之後的事件仍計入「已攔截」，但不畫。
- 同一條航線的流星還在前半段飛行時，新事件只累加次數，不會重複畫。流星寬度固定為 1.2px（`flows.js` 的 `meteorFeature` 保留了依次數加粗的寫法，已註解）。
- 出發時來源國亮起、起點出現光圈；抵達時 SkyCloud 節點出現光圈。
- 來源國與目的地相同的事件（目前只有 L4，例如 CA → CA、US → US）不畫流星，改在目的地顯示較大的橘色光圈，來源國同樣亮起。
- SG、HK、SC 在 110m 國界中沒有自己的多邊形，只顯示光圈、不亮國家。
- 國家或節點不在 `COUNTRY_COORDS` / `SKYCLOUD_NODES` 裡的紀錄會被略過，console 會列出這些代碼。

## 已知問題

- 歐洲、中東 → 美西（例如 IL → US、BG → US）的大圓航線走北大西洋，在以太平洋為中心的畫面中大半落在畫面外。根目錄版本已用 `FLOW.seamLng` 與 `flowPath` 修正，v6 尚未同步。
