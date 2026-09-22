import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { Ref } from 'vue'
import type { CountryFeature, CountryProperties, Flow } from '../types/map'
import { flows } from '../data/flows'

export interface HoverInfo {
  name: string
  clientX: number
  clientY: number
}

export interface UseWorldMapOptions {
  onCountryHover?: (info: HoverInfo) => void
  onCountryLeave?: () => void
}

export interface UseWorldMapHandle {
  destroy: () => void
}

type WorldTopology = Topology<{ countries: GeometryCollection<CountryProperties> }>
type MeteorDatum = { f: Flow; i: number }
type CountrySelection = d3.Selection<SVGPathElement, CountryFeature, SVGGElement, unknown>
type MeteorSelection = d3.Selection<SVGPathElement, MeteorDatum, SVGGElement, unknown>

const BASE_WIDTH = 1000
const BASE_HEIGHT = 520
// px / ms，所有流星線統一用這個速度飛行，不受距離長短影響
const METEOR_SPEED = 0.1

export function useWorldMap(
  svgEl: Ref<SVGSVGElement | null>,
  options: UseWorldMapOptions = {}
): UseWorldMapHandle {
  const timeoutIds = new Set<ReturnType<typeof setTimeout>>()
  const abortController = new AbortController()
  let disposed = false

  let projection: d3.GeoProjection | null = null
  let countryPaths: CountrySelection | null = null
  let meteors: MeteorSelection | null = null

  function scheduleTimeout(fn: () => void, delay: number) {
    const id = setTimeout(() => {
      timeoutIds.delete(id)
      fn()
    }, delay)
    timeoutIds.add(id)
  }

  // 起點/終點國家短暫亮起（柔和淡入淡出）
  function highlightCountry(coord: [number, number], color: string) {
    if (!projection || !countryPaths || !meteors) return
    highlightCountryOnMap(coord, color, projection, countryPaths, meteors)
  }

  // 單一流星飛行一次：起點亮起 → 前進 → 終點亮起 → 淡出
  function fly(
    p: d3.Selection<SVGPathElement, MeteorDatum, null, undefined>,
    d: MeteorDatum,
    total: number,
    frontDur: number,
    fadeDur: number
  ) {
    // 起點亮起（流星效果開始時）
    highlightCountry(d.f.src, '#1998a8')

    p.attr('stroke-dasharray', `0,${total}`)
      .attr('stroke-dashoffset', 0)
      .attr('opacity', 1)
      .transition()
      .duration(frontDur)
      .ease(d3.easeCubicInOut)
      // 前進：尾巴維持一定長度
      .attrTween('stroke-dasharray', function () {
        const head = d3.interpolate(0, total)
        return (t: number) => `${head(t)},${total}`
      })
      .attr('stroke-dashoffset', 0)
      .on('end', () => {
        // 終點亮起（流星到達末尾點時）
        highlightCountry(d.f.dst, '#817ed4')
      })
      .transition()
      // 第二段動畫：淡出
      .duration(fadeDur)
      .ease(d3.easeCubicOut)
      .attr('opacity', 0)
      .on('end', () => {
        p.attr('stroke-dasharray', `0,0`).attr('stroke-dashoffset', 0)
      })
  }

  async function setup() {
    const el = svgEl.value
    if (!el) return

    const svg = d3.select(el)
    const g = svg.append('g')
    const defs = svg.append('defs')

    // 創建兩個 group 來組織層級：國家在底層，流星在上層
    const countriesGroup = g.append('g').attr('class', 'countries-group')
    const meteorsGroup = g.append('g').attr('class', 'meteors-group')

    projection = d3
      .geoNaturalEarth1()
      .scale(170)
      .translate([BASE_WIDTH / 2, BASE_HEIGHT / 2])
    const path = d3.geoPath(projection)

    appendGlowFilter(defs)

    let world: WorldTopology
    try {
      const res = await fetch('/world-110m.json', { signal: abortController.signal })
      world = (await res.json()) as WorldTopology
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      throw err
    }

    if (disposed) return

    const countries = topojson.feature(world, world.objects.countries).features

    countryPaths = drawCountries(countriesGroup, countries, path, options)
    appendMeteorGradients(defs, flows, projection)
    meteors = drawMeteors(meteorsGroup, flows, projection)

    // ✅ 依照 API 提供的 time 欄位排隊播放流星動畫 + 國家亮起效果
    // 做法：找出這批資料裡最早的時間當作第 0 毫秒，其餘連線依照跟最早時間的
    // 差距（ms）用 setTimeout 排隊出發；時間相同就會同時出發，時間分開就會
    // 各自獨立出現。
    const times = flows.map((f) => new Date(f.time).getTime())
    const startTime = Math.min(...times)

    meteors.each(function (d) {
      const p = d3.select<SVGPathElement, MeteorDatum>(this)
      const total = this.getTotalLength()
      const dur = total / METEOR_SPEED // 依實際像素長度換算時長，確保點到點速度一致
      const frontDur = dur * 0.5
      const fadeDur = dur * 0.25
      const delay = times[d.i] - startTime // 這條連線相對於這一輪開始的出發時間

      scheduleTimeout(() => fly(p, d, total, frontDur, fadeDur), delay)
    })
  }

  function destroy() {
    disposed = true
    abortController.abort()
    for (const id of timeoutIds) clearTimeout(id)
    timeoutIds.clear()
    countryPaths?.interrupt()
    meteors?.interrupt()
    const el = svgEl.value
    if (el) {
      d3.select(el).selectAll('*').remove()
    }
  }

  setup()

  return { destroy }
}

function appendGlowFilter(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>) {
  const glow = defs.append('filter').attr('id', 'glow').attr('filterUnits', 'userSpaceOnUse')
  glow.append('feGaussianBlur').attr('stdDeviation', 2).attr('result', 'blur')
  const merge = glow.append('feMerge')
  merge.append('feMergeNode').attr('in', 'blur')
  merge.append('feMergeNode').attr('in', 'SourceGraphic')
}

function drawCountries(
  countriesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  countries: CountryFeature[],
  path: d3.GeoPath,
  options: UseWorldMapOptions
): CountrySelection {
  return countriesGroup
    .selectAll<SVGPathElement, CountryFeature>('path.country')
    .data(countries)
    .join('path')
    .attr('class', 'country')
    .attr('d', path)
    .on('mousemove', (event: MouseEvent, d: CountryFeature) => {
      const props: CountryProperties = d.properties ?? {}
      const name = props.name || props.NAME || 'Unknown'
      options.onCountryHover?.({ name, clientX: event.clientX, clientY: event.clientY })
      d3.select(event.currentTarget as SVGPathElement).classed('hover', true)
    })
    .on('mouseout', (event: MouseEvent) => {
      options.onCountryLeave?.()
      d3.select(event.currentTarget as SVGPathElement).classed('hover', false)
    })
}

function appendMeteorGradients(
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  flows: Flow[],
  projection: d3.GeoProjection
) {
  flows.forEach((f, i) => {
    const [x1, y1] = projection(f.src)!
    const [x2, y2] = projection(f.dst)!
    const grad = defs
      .append('linearGradient')
      .attr('id', `meteorGradient${i}`)
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2)
      .attr('gradientUnits', 'userSpaceOnUse')
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0)
    grad
      .append('stop')
      .attr('offset', '30%')
      .attr('stop-color', '#7df9ff')
      .attr('stop-opacity', 0.8)
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#0ff').attr('stop-opacity', 1)
  })
}

function drawMeteors(
  meteorsGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  flows: Flow[],
  projection: d3.GeoProjection
): MeteorSelection {
  return meteorsGroup
    .selectAll<SVGPathElement, MeteorDatum>('path.meteor')
    .data(flows.map((f, i) => ({ f, i })))
    .join('path')
    .attr('class', 'meteor')
    .attr('d', (d) => {
      const [x1, y1] = projection(d.f.src)!
      const [x2, y2] = projection(d.f.dst)!
      return `M${x1},${y1} L${x2},${y2}`
    })
    .attr('stroke', (d) => `url(#meteorGradient${d.i})`)
    .attr('stroke-width', 0.5)
    .attr('stroke-linecap', 'round')
    .attr('filter', 'url(#glow)')
    .attr('opacity', 0) // 初始不顯示，等排到自己的時間才由 fly() 畫出來
    .attr('stroke-dasharray', function () {
      const total = this.getTotalLength()
      return `0,${total}`
    })
}

function highlightCountryOnMap(
  coord: [number, number],
  color: string,
  projection: d3.GeoProjection,
  countryPaths: CountrySelection,
  meteors: MeteorSelection
) {
  const [x, y] = projection(coord)!

  let foundCountry: SVGPathElement | null = null
  let minDist = Infinity
  let closestCountry: SVGPathElement | null = null

  // 先嘗試找到包含該座標的國家（使用 d3.geoContains 檢查地理座標）
  countryPaths.each(function (d) {
    if (foundCountry) return
    if (d3.geoContains(d, coord)) {
      foundCountry = this
      return
    }

    // 同時記錄最接近的國家（作為備選）
    const [cx, cy] = projection(d3.geoCentroid(d))!
    const dist = Math.hypot(cx - x, cy - y)
    if (dist < minDist) {
      minDist = dist
      closestCountry = this
    }
  })

  // 如果找到包含該點的國家，使用它；否則使用最接近的國家
  const countryEl = foundCountry ?? (minDist < 300 ? closestCountry : null)

  if (countryEl) {
    d3.select(countryEl)
      .transition()
      .duration(200)
      .style('fill', color) // 使用 style 而不是 attr，因為 CSS 優先級更高
      .transition()
      .delay(1000)
      .duration(400)
      .style('fill', 'transparent')

    // 確保流星線條始終在最上層（在國家高亮後）
    meteors.raise()
  }
}
