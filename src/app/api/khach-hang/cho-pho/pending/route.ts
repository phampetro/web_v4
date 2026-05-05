import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';
import { getAuthUser } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  try {
    const authResult = getAuthUser(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json().catch(() => ({}));
    const since = body.since;

    const pool = await connectToDB();
    const requestDB = pool.request();
    
    let query = `
      SELECT Ma_KH, Gia_tri_moi, Trang_thai_duyet, Ngay_duyet, Ngay_dang_ky
      FROM tbl_dangky_chopho 
      WHERE Trang_thai_duyet = N'Chờ duyệt'
    `;

    // Lấy thêm các đơn Đã duyệt sau thời điểm Cache được cập nhật
    if (since && since !== 'null') {
      requestDB.input('since', sql.NVarChar, since);
      query += ` OR (Trang_thai_duyet = N'Đã duyệt' AND Ngay_duyet > @since)`;
    } else {
      // Nếu không có since, mặc định lấy Đã duyệt trong ngày hôm nay theo UTC+7
      query += ` OR (Trang_thai_duyet = N'Đã duyệt' AND CAST(Ngay_duyet AS DATE) = CAST(DATEADD(hour, 7, GETUTCDATE()) AS DATE))`;
    }
    
    const result = await requestDB.query(query);
    
    // Trả về danh sách để Client tự map
    return NextResponse.json(result.recordset);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu' }, { status: 500 });
  }
}
