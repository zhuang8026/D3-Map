// 單一狀態物件 + 簡單的訂閱機制

const state = {
  filter: 'all', // 'all' | 'normal' | 'abnormal'
  hoveredCableId: null,
  selectedCableId: null,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  const changed = Object.keys(patch).some((k) => state[k] !== patch[k]);
  if (!changed) return;
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
