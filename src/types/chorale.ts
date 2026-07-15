export type PerformanceRecord = {
  id: string
  title: string
  description: string | null
  performance_date: string | null
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

export type RehearsalTrackRecord = {
  id: string
  performance_id: string
  title: string
  description: string | null
  composer: string | null
  duration_seconds: number | null
  sort_order: number
  is_published: boolean
  mime_type: string | null
  created_at: string
  updated_at: string
}

export type ChoraleSignedUpload = {
  bucket: string
  objectPath: string
  path: string
  token: string
}

export type ChoraleSignedUploadResponse = {
  signedUpload: ChoraleSignedUpload
}
