import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { maKHs } = body;

    if (!maKHs || !Array.isArray(maKHs) || maKHs.length === 0) {
      return NextResponse.json([]);
    }

    const pool = await connectToDB();
    const requestDB = pool.request();
    
    // Tạo danh sách tham số động @p0, @p1, @p2...
    const params = maKHs.map((id, index) => {
      const paramName = `p${index}`;
      requestDB.input(paramName, sql.NVarChar, id);
      return `@${paramName}`;
    }).join(',');

    const query = `
      SELECT Ma_KH, Trang_thai_duyet 
      FROM tbl_dangky_chopho 
      WHERE Ma_KH IN (${params}) 
      AND Trang_thai_duyet = N'Chờ duyệt'
    `;

    const result = await requestDB.query(query);

    return NextResponse.json(result.recordset);
  } catch (error: any) {
    console.error('Check Pending Cho-Pho Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
