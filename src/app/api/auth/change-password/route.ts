import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  // Kiểm tra session
  const session = req.cookies.get('session_token');
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { oldPassword, newPassword, username } = await req.json();
  const targetUser = username;

  if (!targetUser) {
    return NextResponse.json({ error: 'Không xác định được người dùng' }, { status: 400 });
  }

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' }, { status: 400 });
  }

  const db = await connectToDB();
  const result = await db.query`SELECT * FROM UserInfo WHERE ID = ${targetUser}`;
  const user = result.recordset[0];

  if (!user) {
    return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
  }

  // Kiểm tra mật khẩu cũ
  const passwordMatch = await bcrypt.compare(oldPassword, user.pass_hash);
  if (!passwordMatch) {
    return NextResponse.json({ error: 'Mật khẩu cũ không đúng' }, { status: 400 });
  }

  // Hash mật khẩu mới và cập nhật
  const newHash = await bcrypt.hash(newPassword, 12);
  await db.query`UPDATE UserInfo SET pass_hash = ${newHash} WHERE ID = ${targetUser}`;

  return NextResponse.json({ message: 'Đổi mật khẩu thành công' });
}
