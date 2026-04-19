import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/lib/auth';

export async function GET() {
  const csrfToken = generateToken();
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
