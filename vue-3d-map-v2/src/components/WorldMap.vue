<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useWorldMap, type UseWorldMapHandle } from '../composables/useWorldMap'
import MapTooltip from './MapTooltip.vue'

const svgRef = ref<SVGSVGElement | null>(null)
const tooltip = reactive({ visible: false, text: '', x: 0, y: 0 })

let handle: UseWorldMapHandle | null = null

onMounted(() => {
  handle = useWorldMap(svgRef, {
    onCountryHover: (info) => {
      tooltip.visible = true
      tooltip.text = info.name
      tooltip.x = info.clientX
      tooltip.y = info.clientY
    },
    onCountryLeave: () => {
      tooltip.visible = false
    },
  })
})

onUnmounted(() => {
  handle?.destroy()
})
</script>

<template>
  <svg ref="svgRef" id="map" viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet"></svg>
  <MapTooltip :visible="tooltip.visible" :text="tooltip.text" :x="tooltip.x" :y="tooltip.y" />
</template>

<style scoped>
#map {
  width: 100%;
  height: auto;
  display: block;
}

:deep(.country) {
  fill: transparent;
  stroke: #3a4964;
  stroke-width: 0.5;
}

:deep(.country.hover) {
  fill: #2a3a56 !important;
}
</style>
