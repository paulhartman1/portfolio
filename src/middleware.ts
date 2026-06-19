import { NextRequest, NextResponse } from 'next/server'

// Only these origins may call the review API from another subdomain.
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  try {
    const { hostname } = new URL(origin)
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    // Allow loveondev.com, www.loveondev.com, and any subdomain
    return hostname === 'loveondev.com' || 
           hostname === 'www.loveondev.com' || 
           hostname.endsWith('.loveondev.com')
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {}
  return {
    // Echo the specific origin (required when credentials are included).
    'Access-Control-Allow-Origin': origin as string,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  }
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)

  // Answer the preflight request directly.
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers })
  }

  // Attach CORS headers to the actual response.
  const response = NextResponse.next()
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }
  return response
}

export const config = {
  matcher: '/api/review/:path*',
}
