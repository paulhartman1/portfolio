import { createServiceRoleClient } from '@/utils/supabase/service-role'

export const CHORALE_AUDIO_BUCKET = 'chorale-audio'
export const CHORALE_STREAM_TTL_SECONDS = 60 * 5

export async function createChoraleStreamSignedUrl(storageObjectPath: string) {
  const serviceRole = createServiceRoleClient()

  const { data, error } = await serviceRole.storage
    .from(CHORALE_AUDIO_BUCKET)
    .createSignedUrl(storageObjectPath, CHORALE_STREAM_TTL_SECONDS, {
      download: false,
    })

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Unable to create stream URL')
  }

  return {
    streamUrl: data.signedUrl,
    expiresInSeconds: CHORALE_STREAM_TTL_SECONDS,
  }
}

export async function createChoraleSignedUpload(payload: {
  performanceId: string
  originalFileName: string
}) {
  const serviceRole = createServiceRoleClient()
  const safeFileName = payload.originalFileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
  const objectPath = `${payload.performanceId}/${crypto.randomUUID()}-${safeFileName}`

  const { data, error } = await serviceRole.storage
    .from(CHORALE_AUDIO_BUCKET)
    .createSignedUploadUrl(objectPath)

  if (error || !data?.token) {
    throw new Error(error?.message || 'Unable to create signed upload URL')
  }

  return {
    bucket: CHORALE_AUDIO_BUCKET,
    objectPath,
    token: data.token,
    path: data.path,
  }
}
