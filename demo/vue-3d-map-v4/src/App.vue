<script setup>
// 展示 CableMap 的用法：外層負責取得資料，再透過 props 傳入。
// 在 cdn_frontend_vue 裡，這裡換成專案自己的 API 呼叫即可。

import {
  markRaw, onMounted, ref, shallowRef,
} from 'vue';
import CableMap from './components/CableMap/CableMap.vue';

const base = `${import.meta.env.BASE_URL}cable-map/`;

// 大型資料用 shallowRef + markRaw，不讓 Vue 深層代理
const data = shallowRef(null);
const error = ref('');
const mounted = ref(true);
const filter = ref('all');
const selected = ref(null);
const mapRef = ref(null);

async function getJson(path) {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

onMounted(async () => {
  try {
    const [ids, incidents, landingPoints, traffic, countries] = await Promise.all([
      getJson('cables/index.json'),
      getJson('incidents.json'),
      getJson('landing-points.json'),
      getJson('traffic.json'),
      getJson('countries-110m.geo.json'),
    ]);
    const cables = await Promise.all(ids.map((id) => getJson(`cables/${id}.json`)));
    data.value = markRaw({
      cables, incidents, landingPoints, traffic, countries,
    });
  } catch (err) {
    error.value = err.message;
  }
});
</script>

<template>
  <div class="demo">
    <header>
      <strong>CableMap</strong>
      <span>篩選：{{ filter }}</span>
      <span>選取：{{ selected ?? '—' }}</span>
      <button type="button" @click="mapRef?.toggle()">播放 / 暫停（defineExpose）</button>
      <button type="button" @click="mounted = !mounted">
        {{ mounted ? '卸載元件' : '重新掛載' }}
      </button>
    </header>

    <main>
      <p v-if="error" class="error">{{ error }}</p>
      <CableMap
        v-else-if="data && mounted"
        ref="mapRef"
        v-model:filter="filter"
        :cables="data.cables"
        :incidents="data.incidents"
        :landing-points="data.landingPoints"
        :traffic="data.traffic"
        :countries="data.countries"
        @select-cable="(id) => { selected = id; }"
        @error="(err) => { error = err.message; }"
      />
    </main>
  </div>
</template>

<style lang="less">
html,
body {
  height: 100%;
  margin: 0;
}

.demo {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: system-ui, sans-serif;

  header {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 8px 16px;
    border-bottom: 1px solid #ddd;
    font-size: 14px;
  }

  main {
    flex: 1;
    min-height: 0;
  }

  .error {
    padding: 16px;
    color: #c00;
  }
}
</style>
