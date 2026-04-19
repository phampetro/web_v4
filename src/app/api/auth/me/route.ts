import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = req.cookies.get('session_token');
  if (session) {
    return NextResponse.json({ loggedIn: true });
  }
  return NextResponse.json({ loggedIn: false });
}
