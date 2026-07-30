import { NextRequest, NextResponse } from 'next/server'

// Gate the statically-served pricing admin dashboard with HTTP Basic Auth.
// The dashboard's own "admin token" only guards calls to the Cloudflare
// Worker — it does nothing to stop the page itself from loading publicly.
export const config = {
  matcher: '/pricing-admin.html',
}

function unauthorized(): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Pricing Admin"' },
  })
}

export function middleware(request: NextRequest): NextResponse {
  const expectedUser = process.env.PRICING_ADMIN_USERNAME
  const expectedPass = process.env.PRICING_ADMIN_PASSWORD

  // Fail closed: if the gate isn't configured, don't serve the page.
  if (!expectedUser || !expectedPass) {
    return new NextResponse('Pricing admin is not configured', { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Basic ')) {
    const encoded = authHeader.slice('Basic '.length)
    let decoded = ''
    try {
      decoded = atob(encoded)
    } catch {
      return unauthorized()
    }

    const separatorIndex = decoded.indexOf(':')
    const user = separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex)
    const pass = separatorIndex === -1 ? '' : decoded.slice(separatorIndex + 1)

    if (user === expectedUser && pass === expectedPass) {
      return NextResponse.next()
    }
  }

  return unauthorized()
}
