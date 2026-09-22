import type { Flow } from '../types/map'

// 經緯度 [經度, 緯度] - mockdata
// time：API 提供的絕對時間戳記（ISO 字串），流星連線依照這個時間先後出發，
// 時間相同的會同時發生，時間分開的就只有一條在飛
export const flows: Flow[] = [
  { src: [-77.0, 38.9], dst: [100.5, 13.7], time: '2026-09-16T10:00:00Z' }, // Washington → Bangkok
  { src: [-47.9, -15.8], dst: [100.5, 13.7], time: '2026-09-16T10:00:00Z' }, // Brasília → Bangkok
  { src: [-74.0, 40.7], dst: [100.5, 13.7], time: '2026-09-16T10:00:02Z' }, // New York → Bangkok
  { src: [-0.1, 51.5], dst: [100.5, 13.7], time: '2026-09-16T10:00:03Z' }, // London → Bangkok
  { src: [-77.0, 38.9], dst: [139.7, 35.7], time: '2026-09-16T10:00:03Z' }, // Washington → Tokyo
  { src: [-47.9, -15.8], dst: [2.3, 48.9], time: '2026-09-16T10:00:05Z' }, // Brasília → Paris
  { src: [-74.0, 40.7], dst: [-0.1, 51.5], time: '2026-09-16T10:00:08Z' }, // New York → London
  { src: [-0.1, 51.5], dst: [116.4, 39.9], time: '2026-09-16T10:00:08Z' }, // London → Beijing
  { src: [139.7, 35.7], dst: [100.5, 13.7], time: '2026-09-16T10:00:10Z' }, // Tokyo → Bangkok
  { src: [2.3, 48.9], dst: [13.4, 52.5], time: '2026-09-16T10:00:13Z' }, // Paris → Berlin
  { src: [151.2, -33.9], dst: [139.7, 35.7], time: '2026-09-16T10:00:15Z' }, // Sydney → Tokyo
  { src: [116.4, 39.9], dst: [72.9, 19.1], time: '2026-09-16T10:00:15Z' }, // Beijing → Mumbai
  { src: [37.6, 55.8], dst: [-74.0, 40.7], time: '2026-09-16T10:00:18Z' }, // Moscow → New York
  { src: [72.9, 19.1], dst: [100.5, 13.7], time: '2026-09-16T10:00:20Z' }, // Mumbai → Bangkok
]
