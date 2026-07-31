import type { CookieOptions } from '@supabase/ssr'

/** Share auth cookies across *.loveondev.com (host-only on localhost). */
export function authCookieOptions(): CookieOptions | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined
  return { domain: '.loveondev.com', path: '/', sameSite: 'lax' }
}
