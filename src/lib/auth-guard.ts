import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'fallback_secret_change_me';

/**
 * Tạo signed session token: username + timestamp + signature
 */
export function createSessionToken(username: string): string {
  const payload = `${username}:${Date.now()}`;
  const signature = createHmac('sha256', SECRET).update(payload).digest('hex');
  // Encode base64 để an toàn trong cookie
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

/**
 * Xác minh session token và trả về username
 */
export function verifySessionToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 3) return null;

    const username = parts[0];
    const timestamp = parts[1];
    const providedSig = parts.slice(2).join(':');

    // Xác minh chữ ký
    const payload = `${username}:${timestamp}`;
    const expectedSig = createHmac('sha256', SECRET).update(payload).digest('hex');
    if (providedSig !== expectedSig) return null;

    // Kiểm tra hết hạn (8 giờ)
    const elapsed = Date.now() - parseInt(timestamp);
    const MAX_AGE = 8 * 60 * 60 * 1000; // 8 tiếng
    if (elapsed > MAX_AGE) return null;

    return username;
  } catch {
    return null;
  }
}

/**
 * Helper kiểm tra xác thực cho API routes.
 * Trả về username nếu hợp lệ, hoặc NextResponse lỗi nếu không.
 */
export function getAuthUser(req: NextRequest): string | NextResponse {
  const token = req.cookies.get('session_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const username = verifySessionToken(token);
  if (!username) {
    return NextResponse.json({ error: 'Phiên đăng nhập hết hạn' }, { status: 401 });
  }

  return username;
}
