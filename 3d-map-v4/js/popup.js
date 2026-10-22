// Popup / hover 提示的 HTML 內容

import { STATUS_LABEL, EQUIPMENT_LABEL } from './config.js';

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function day(iso) {
  return iso ? iso.slice(0, 10) : '—';
}

function badge(status) {
  return `<span class="badge ${status}">${STATUS_LABEL[status] ?? status}</span>`;
}

function incidentHtml(incident) {
  return `
    <div class="incident">
      <div>${badge(incident.status)} <span class="title">${esc(incident.title || '（未命名事件）')}</span></div>
      <div class="dates">發生：${day(incident.date)}　預計修復：${day(incident.reparing_at)}</div>
    </div>`;
}

export function hoverTipHtml(name, sub) {
  return `<div class="name">${esc(name)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}`;
}

export function cablePopupHtml({ cableName, segmentId, segmentStatus, incidents, unlocated }) {
  return `
    <div class="pop">
      <h3>${esc(cableName)}</h3>
      <div class="meta">區段 ${esc(segmentId)}　${badge(segmentStatus)}</div>
      ${incidents.length ? incidents.map(incidentHtml).join('') : '<div class="meta">此區段目前無進行中事件</div>'}
      ${unlocated.length ? `<div class="section-title">本海纜其他事件（未標明區段）</div>${unlocated.map(incidentHtml).join('')}` : ''}
    </div>`;
}

export function pointPopupHtml({ name, type, cableName }) {
  const sub = type ? `${EQUIPMENT_LABEL[type] ?? type}・${cableName}` : '登陸點';
  return `
    <div class="pop">
      <h3>${esc(name)}</h3>
      <div class="meta">${esc(sub)}</div>
    </div>`;
}
