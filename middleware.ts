// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type Geo = {
  city?: string;
  country?: string;
  region?: string;
  latitude?: string;
  longitude?: string;
};

function getClientInfo(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined;

  const geo: Geo = {
    city: req.headers.get('x-vercel-ip-city') || undefined,
    country: req.headers.get('x-vercel-ip-country') || undefined,
    region: req.headers.get('x-vercel-ip-country-region') || undefined,
    latitude: req.headers.get('x-vercel-ip-latitude') || undefined,
    longitude: req.headers.get('x-vercel-ip-longitude') || undefined,
  };

  return { ip, geo };
}

export function middleware(req: NextRequest) {
  const { ip, geo } = getClientInfo(req);
  // ...your logic using ip/geo...
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
