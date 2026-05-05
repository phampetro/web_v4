import { connectToDB } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

export async function authenticateUser(username: string, password: string) {
  try {
    const db = await connectToDB();
    // Sử dụng request().query cho tagged template với pool cụ thể
    const result = await db.request().query`SELECT * FROM UserInfo WHERE ID = ${username}`;
    const user = result.recordset[0];
    if (!user) return null;
    
    // So khớp mật khẩu (pass_hash trong DB)
    const passwordMatch = await bcrypt.compare(password, user.pass_hash);
    if (!passwordMatch) return null;
    
    return { id: user.ID, username: user.ID };
  } catch (error) {
    console.error('AuthenticateUser error:', error);
    throw error; // Ném tiếp để API route bắt được
  }
}

/**
 * Tạo token ngẫu nhiên cho Session hoặc CSRF
 */
export function generateToken() {
  return randomBytes(32).toString('hex');
}
