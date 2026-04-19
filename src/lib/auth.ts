import { connectToDB } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

export async function authenticateUser(username: string, password: string) {
  const db = await connectToDB();
  // Truy vấn bảng UserInfo, username là ID, password là pass_hash
  const result = await db.query`SELECT * FROM UserInfo WHERE ID = ${username}`;
  const user = result.recordset[0];
  if (!user) return null;
  const passwordMatch = await bcrypt.compare(password, user.pass_hash);
  if (!passwordMatch) return null;
   // Trả về thông tin user (ẩn trường nhạy cảm)
   return { id: user.ID, username: user.ID };
}

/**
 * Tạo token ngẫu nhiên cho Session hoặc CSRF
 */
export function generateToken() {
  return randomBytes(32).toString('hex');
}
