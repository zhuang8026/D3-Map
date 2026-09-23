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
// 一輪（所有連線）播完後，等多久才從頭重播下一輪（ms）
const LOOP_GAP = 1000

// 掛載地圖：畫國家、畫流星線、排動畫循環，回傳 destroy() 供元件卸載時清理
export const useWorldMap = (
  svgEl: Ref<SVGSVGElement | null>,
  options: UseWorldMapOptions = {}
): UseWorldMapHandle => {
  const timeoutIds = new Set<ReturnType<typeof setTimeout>>()
  const abortController = new AbortController()
  let disposed = false

  let projection: d3.GeoProjection | null = null
  let countryPaths: CountrySelection | null = null
  let meteors: MeteorSelection | null = null

  const scheduleTimeout = (fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timeoutIds.delete(id)
      fn()
    }, delay)
    timeoutIds.add(id)
  }

  // 起點/終點國家短暫亮起（柔和淡入淡出）
  const highlightCountry = (coord: [number, number], color: string) => {
    if (!projection || !countryPaths || !meteors) return
    highlightCountryOnMap(coord, color, projection, countryPaths, meteors)
  }

  // 依照 flows 的 time 欄位排隊播放一輪流星動畫 + 國家亮起效果，
  // 並在整輪播完後排下一輪，形成無限循環。
  // 做法：找出這批資料裡最早的時間當作第 0 毫秒，其餘連線依照跟最早時間的
  // 差距（ms）用 scheduleTimeout 排隊出發；時間相同就會同時出發，時間分開就會
  // 各自獨立出現。同時記錄這一輪最晚結束的時間點（cycleEnd，含飛行 + 淡出），
  // 等這一輪真正播完、再加上 LOOP_GAP 的間隔後才重新呼叫自己排下一輪。
  // 注意：這裡一定要用 scheduleTimeout（而不是裸 setTimeout），
  // 循環用的計時器才會被 destroy() 一併清掉，避免元件卸載後動畫仍在背景重播。
  const scheduleAnimationLoop = () => {
    if (!meteors) return

    const times = flows.map((f) => new Date(f.time).getTime())
    const startTime = Math.min(...times)
    let cycleEnd = 0

    meteors.each((d, i, nodes) => {
      const node = nodes[i]
      const p = d3.select<SVGPathElement, MeteorDatum>(node)
      const total = node.getTotalLength()
      const dur = total / METEOR_SPEED // 依實際像素長度換算時長，確保點到點速度一致
      const frontDur = dur * 0.5
      const fadeDur = dur * 0.25
      const delay = times[d.i] - startTime // 這條連線相對於這一輪開始的出發時間

      cycleEnd = Math.max(cycleEnd, delay + frontDur + fadeDur)
      scheduleTimeout(() => fly(p, d, total, frontDur, fadeDur), delay)
    })

    scheduleTimeout(scheduleAnimationLoop, cycleEnd + LOOP_GAP) // 循環
  }

  // 單一流星飛行一次：起點亮起 → 前進 → 終點亮起 → 淡出
  const fly = (
    p: d3.Selection<SVGPathElement, MeteorDatum, null, undefined>,
    d: MeteorDatum,
    total: number,
    frontDur: number,
    fadeDur: number
  ) => {
    // 起點亮起（流星效果開始時）
    highlightCountry(d.f.src, '#1998a8')

    p.attr('stroke-dasharray', `0,${total}`)
      .attr('stroke-dashoffset', 0)
      .attr('opacity', 1)
      .transition()
      .duration(frontDur)
      .ease(d3.easeCubicInOut)
      // 前進：尾巴維持一定長度
      .attrTween('stroke-dasharray', () => {
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

  const setup = async () => {
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

    scheduleAnimationLoop()
  }

  const destroy = () => {
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

// 建立流星線用的模糊光暈 SVG filter
const appendGlowFilter = (defs: d3.Selection<SVGDefsElement, unknown, null, undefined>) => {
  const glow = defs.append('filter').attr('id', 'glow').attr('filterUnits', 'userSpaceOnUse')
  glow.append('feGaussianBlur').attr('stdDeviation', 2).attr('result', 'blur')
  const merge = glow.append('feMerge')
  merge.append('feMergeNode').attr('in', 'blur')
  merge.append('feMergeNode').attr('in', 'SourceGraphic')
}

// 畫出所有國家的 path，並綁定 hover 顯示 tooltip / 高亮的事件
const drawCountries = (
  countriesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  countries: CountryFeature[],
  path: d3.GeoPath,
  options: UseWorldMapOptions
): CountrySelection => {
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

// 為每條 flow 建立對應的漸層（依投影後的螢幕座標），供流星線描邊使用
const appendMeteorGradients = (
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  flows: Flow[],
  projection: d3.GeoProjection
) => {
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

// 畫出每條 flow 對應的流星線條（初始不可見，等排到時間才由 fly() 播放）
const drawMeteors = (
  meteorsGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  flows: Flow[],
  projection: d3.GeoProjection
): MeteorSelection => {
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
    .attr('stroke-dasharray', (_d, i, nodes) => {
      const total = nodes[i].getTotalLength()
      return `0,${total}`
    })
}

// 找出座標所在（或最接近）的國家，短暫變色再淡出，實際執行 highlightCountry 的邏輯
const highlightCountryOnMap = (
  coord: [number, number],
  color: string,
  projection: d3.GeoProjection,
  countryPaths: CountrySelection,
  meteors: MeteorSelection
) => {
  const [x, y] = projection(coord)!

  let foundCountry: SVGPathElement | null = null
  let minDist = Infinity
  let closestCountry: SVGPathElement | null = null

  // 先嘗試找到包含該座標的國家（使用 d3.geoContains 檢查地理座標）
  countryPaths.each((d, i, nodes) => {
    if (foundCountry) return
    if (d3.geoContains(d, coord)) {
      foundCountry = nodes[i]
      return
    }

    // 同時記錄最接近的國家（作為備選）
    const [cx, cy] = projection(d3.geoCentroid(d))!
    const dist = Math.hypot(cx - x, cy - y)
    if (dist < minDist) {
      minDist = dist
      closestCountry = nodes[i]
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
