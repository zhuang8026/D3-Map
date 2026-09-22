export interface Flow {
  src: [number, number]
  dst: [number, number]
  time: string
}

export interface CountryProperties {
  name?: string
  NAME?: string
  [key: string]: unknown
}

export type CountryFeature = GeoJSON.Feature<GeoJSON.Geometry, CountryProperties>
