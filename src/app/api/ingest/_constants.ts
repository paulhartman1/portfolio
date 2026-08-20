export const MAX_REQUEST_BODY_BYTES = 30 * 1024 * 1024 // 30MB (base64 inflates ~33%)
export const MAX_RAW_MIME_BYTES = 20 * 1024 * 1024 // 20MB decoded raw payload ceiling
export const TIMESTAMP_TOLERANCE_SECONDS = 300 // 5 minutes
