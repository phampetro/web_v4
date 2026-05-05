import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { createSessionToken } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  try {
    // Kiểm tra CSRF token
    const csrfHeader = req.headers.get('x-csrf-token');
    const csrfCookie = req.cookies.get('csrf_token')?.value;
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return NextResponse.json({ error: 'CSRF token invalid' }, { status: 403 });
    }

    const body = await req.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Missing username or password' }, { status: 400 });
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    // Sinh signed session token (chứa username + timestamp + chữ ký)
    const sessionToken = createSessionToken(user.username);
    
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
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json({ 
      error: 'Lỗi hệ thống khi đăng nhập',
      details: error.message 
    }, { status: 500 });
  }
}
