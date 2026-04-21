import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    let username = cookieStore.get('username')?.value || '';
    
    const body = await request.json();
    const { khuVucList, username: clientUsername, checkOnly } = body;
    const finalUsername = username || clientUsername;

    if (!finalUsername) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = await connectToDB();

    // 1. Lấy ngày cập nhật gốc từ hệ thống
    const metaResult = await pool.request().query('SELECT TOP(1) [Ngay_Update] FROM Web_NgayUpdate');
    const serverNgayUpdate = metaResult.recordset[0]?.['Ngay_Update'] ?? null;

    if (checkOnly) {
      return NextResponse.json({ ngayUpdate: serverNgayUpdate });
    }

    if (!khuVucList || !Array.isArray(khuVucList) || khuVucList.length === 0) {
      return NextResponse.json({ data: [], ngayUpdate: serverNgayUpdate });
    }

    const sqlRequest = pool.request();
    let query = 'SELECT DISTINCT MA_KH, TRENDUONG_TRONGCHO FROM tbl_tuyen WHERE TEN_KHUVUC IN (';
    khuVucList.forEach((kv: string, index: number) => {
      const paramName = `kv${index}`;
      sqlRequest.input(paramName, sql.NVarChar, kv);
      query += `@${paramName}${index < khuVucList.length - 1 ? ',' : ''}`;
    });
    query += ')';

    const result = await sqlRequest.query(query);

    return NextResponse.json({
        data: result.recordset,
        ngayUpdate: serverNgayUpdate
    });
  } catch (error: any) {
    console.error('API Cho-Pho Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
