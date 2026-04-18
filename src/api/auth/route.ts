import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const user = await authenticateUser(username, password);
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  // Đăng nhập thành công: set cookie HTTPOnly
  const res = NextResponse.json({ user });
  res.cookies.set('isLoggedIn', 'true', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 8, // 8 tiếng
  });
  return res;
}
