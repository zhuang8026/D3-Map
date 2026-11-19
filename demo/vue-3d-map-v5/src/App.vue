<template>
  <div class="app">
    <CableMap
      v-model:filter="filter"
      :cables="data.cables"
      :incidents="data.incidents"
      :landing-points="data.landingPoints"
      :traffic="data.traffic"
      :countries="data.countries"
      :loading="loading"
      @select="selectedCableId = $event"
      @error="onMapError"
    />
    <div v-if="error" class="app__error" role="alert">資料載入失敗：{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted } from 'vue';
import CableMap from '@/components/CableMap';
import { loadMapData } from '@/api/mapData';

// 資料量大（traffic 約 1MB），用 shallowRef 避免深層響應式
const data = shallowRef({
  cables: [], incidents: [], landingPoints: [], traffic: [], countries: null,
});
const loading = ref(true);
const error = ref('');
const filter = ref('all');
const selectedCableId = ref(null);

function onMapError(err) {
  console.error('[App] 地圖錯誤：', err);
}

onMounted(async () => {
  try {
    data.value = await loadMapData();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="less">
html,
body {
  height: 100%;
  margin: 0;
  background: #16171b;
}

#app {
  height: 100%;
}
</style>

<style lang="less" scoped>
.app {
  position: relative;
  height: 100%;

  &__error {
    position: absolute;
    top: 16px;
    left: 50%;
    z-index: 20;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(255, 59, 59, 0.9);
    color: #fff;
    transform: translateX(-50%);
  }
}
</style>
