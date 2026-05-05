import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth-guard';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value;
  if (!token) {
    return NextResponse.json({ loggedIn: false });
  }

  // Xác minh token thực sự (kiểm tra chữ ký + hạn sử dụng)
  const username = verifySessionToken(token);
  if (!username) {
    return NextResponse.json({ loggedIn: false });
  }

  return NextResponse.json({ loggedIn: true, username });
}
