export type ChoralePerformance = {
  id: string
  title: string
  description: string | null
  performance_date: string | null
  sort_order: number
}

export type ChoraleTrack = {
  id: string
  performance_id: string
  title: string
  description: string | null
  composer: string | null
  duration_seconds: number | null
  sort_order: number
}
