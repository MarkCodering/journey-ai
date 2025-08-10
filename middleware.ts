// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  // Skip static assets and API by default while debugging
  matcher: ['/((?!_next/|favicon.ico|robots.txt|sitemap.xml|api/).*)'],
};

export function middleware(_req: NextRequest) {
  try {
    return NextResponse.next();
  } catch (err) {
    const res = NextResponse.next();
    res.headers.set(
      'x-middleware-error',
      err instanceof Error ? err.message : String(err)
    );
    return res;
  }
}
