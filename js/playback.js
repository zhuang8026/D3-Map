// 流量播放控制列：播放 / 暫停、倍速、資料時間與已攔截次數

import { FLOW } from './config.js';

const pad = (n) => String(n).padStart(2, '0');

// 資料時間一律以台灣時間（UTC+8）顯示，與 traffic.json 的時區一致
function formatClock(ms) {
  const d = new Date(ms + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function bindPlayback(flows) {
  const toggle = document.getElementById('play-toggle');
  const clock = document.getElementById('play-clock');
  const count = document.getElementById('play-count');
  const speed = document.getElementById('play-speed');

  speed.innerHTML = FLOW.rates.map((r) => `<option value="${r}">${r}×</option>`).join('');
  speed.value = String(FLOW.playbackRate);
  speed.addEventListener('change', () => flows.setRate(Number(speed.value)));
  toggle.addEventListener('click', () => flows.toggle());
  document.querySelectorAll('.legend input[data-layer]').forEach((input) => {
    input.addEventListener('change', () => flows.setLayerEnabled(input.dataset.layer, input.checked));
  });

  // 每幀都會通知，只在文字真的改變時才動 DOM
  let lastText = '';
  flows.subscribe((p) => {
    const text = `${p.playing}|${formatClock(p.clock)}|${p.count}`;
    if (text === lastText) return;
    lastText = text;
    toggle.textContent = p.playing ? '❚❚' : '▶';
    toggle.setAttribute('aria-label', p.playing ? '暫停' : '播放');
    clock.textContent = formatClock(p.clock);
    count.textContent = `已攔截 ${p.count.toLocaleString()} / ${flows.total.toLocaleString()}`;
  });
}
