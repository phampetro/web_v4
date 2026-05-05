import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;

  // Xử lý các route giao diện
  if (request.nextUrl.pathname.startsWith('/login') && sessionToken) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  if (request.nextUrl.pathname.startsWith('/home') && !sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Bảo vệ tất cả các API routes (ngoại trừ /api/auth)
  if (request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/api/auth/')) {
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/home/:path*', '/api/:path*'],
};
