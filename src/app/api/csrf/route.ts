import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/csrf';

export async function GET() {
  const csrfToken = generateCSRFToken();
  const res = NextResponse.json({ csrfToken });
  res.cookies.set('csrf_token', csrfToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10, // 10 phút
  });
  return res;
}
