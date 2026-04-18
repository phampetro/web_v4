import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { generateSessionToken } from '@/lib/session';

export async function POST(req: NextRequest) {
  // Kiểm tra CSRF token
  const csrfHeader = req.headers.get('x-csrf-token');
  const csrfCookie = req.cookies.get('csrf_token')?.value;
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return NextResponse.json({ error: 'CSRF token invalid' }, { status: 403 });
  }

  const { username, password } = await req.json();
  const user = await authenticateUser(username, password);
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  // Sinh session token ngẫu nhiên
  const sessionToken = generateSessionToken();
  // TODO: Lưu sessionToken kèm user vào DB/Redis (hiện tại chỉ demo, chưa lưu)
  const res = NextResponse.json({ user });
  res.cookies.set('session_token', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 tiếng
  });
  // Lưu username vào cookie (không httpOnly để client đọc được)
  res.cookies.set('username', user.username, {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  // Debug log giá trị quyenQL
  console.log('DEBUG quyenQL:', user.quyenDL);
  // Lưu Quyen_QL vào cookie để client dùng cho WHERE IN
  res.cookies.set('quyen_dl', user.quyenDL, {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return res;
}
