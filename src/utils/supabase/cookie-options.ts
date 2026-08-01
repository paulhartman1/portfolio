import type { CookieOptions } from '@supabase/ssr'

/**
 * Auth cookies are host-only.
 *
 * We previously scoped these to `.loveondev.com` to share sessions across
 * subdomains (cgt.loveondev.com, the review widget). That left returning users
 * with a duplicate `sb-*-auth-token` cookie (old host-only + new domain-scoped).
 * The server would then refresh the stale token and fail with
 * `refresh_token_not_found`, bouncing users back to the login screen.
 *
 * Client portals are served as paths (`/portal/[subdomain]`) on the primary
 * host, so host-only cookies are sufficient for the main app. Returning
 * `undefined` restores the default @supabase/ssr host-only behavior.
 *
 * Cross-subdomain session sharing can be reintroduced later in a host-aware
 * way that also clears the conflicting cookie.
 */
export function authCookieOptions(): CookieOptions | undefined {
  return undefined
}
