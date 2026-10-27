// Popup 的 HTML 內容（MapLibre Popup 只吃 HTML 字串，所有資料都要先 escape）

const ESCAPES = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function day(iso) {
  return iso ? iso.slice(0, 10) : '—';
}

function badge(status, labels) {
  return `<span class="badge ${esc(status)}">${esc(labels.status[status] ?? status)}</span>`;
}

function incidentHtml(incident, labels) {
  const title = esc(incident.title || labels.untitledIncident);
  return `
    <div class="incident">
      <div>${badge(incident.status, labels)} <span class="title">${title}</span></div>
      <div class="dates">
        ${esc(labels.occurredAt)}：${day(incident.date)}
        ${esc(labels.repairAt)}：${day(incident.reparing_at)}
      </div>
    </div>`;
}

export function cablePopupHtml({
  cableName, segmentId, segmentStatus, incidents, unlocated,
}, labels) {
  const list = incidents.length
    ? incidents.map((i) => incidentHtml(i, labels)).join('')
    : `<div class="meta">${esc(labels.noIncident)}</div>`;
  const others = unlocated.length
    ? `<div class="section-title">${esc(labels.unlocatedIncidents)}</div>
       ${unlocated.map((i) => incidentHtml(i, labels)).join('')}`
    : '';
  return `
    <div class="pop">
      <h3>${esc(cableName)}</h3>
      <div class="meta">${esc(labels.segment)} ${esc(segmentId)}&emsp;${badge(segmentStatus, labels)}</div>
      ${list}
      ${others}
    </div>`;
}

export function pointPopupHtml({ name, type, cableName }, labels) {
  const sub = type
    ? `${labels.equipment[type] ?? type}・${cableName}`
    : labels.landingPoint;
  return `
    <div class="pop">
      <h3>${esc(name)}</h3>
      <div class="meta">${esc(sub)}</div>
    </div>`;
}
