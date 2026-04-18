import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session_token');
  const { pathname } = request.nextUrl;

  // Nếu đã đăng nhập, vào /login thì chuyển về /home
  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // Nếu chưa đăng nhập, vào /home thì chuyển về /login
  if (pathname === '/home' && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/home'],
};
