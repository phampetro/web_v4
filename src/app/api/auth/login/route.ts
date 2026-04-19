import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateToken } from '@/lib/auth';

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
  const sessionToken = generateToken();
  // TODO: Lưu sessionToken kèm user vào DB/Redis
  
  const res = NextResponse.json({ 
    user: {
      id: user.id,
      username: user.username
    } 
  });

  res.cookies.set('session_token', sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 tiếng
  });

  return res;
}
