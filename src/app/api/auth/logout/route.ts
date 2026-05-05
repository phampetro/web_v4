import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  // Xóa session cookie
  res.cookies.set('session_token', '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  // Xóa username cookie nếu có
  res.cookies.set('username', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
