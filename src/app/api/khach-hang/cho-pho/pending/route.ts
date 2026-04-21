import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since'); // Ngày cập nhật của Cache hiện tại

    const pool = await connectToDB();
    const req = pool.request();
    
    let query = `
      SELECT Ma_KH, Gia_tri_moi, Trang_thai_duyet, Ngay_duyet, Ngay_dang_ky
      FROM tbl_dangky_chopho 
      WHERE Trang_thai_duyet = N'Chờ duyệt'
    `;

    // Lấy thêm các đơn Đã duyệt sau thời điểm Cache được cập nhật
    if (since && since !== 'null') {
      req.input('since', sql.NVarChar, since);
      query += ` OR (Trang_thai_duyet = N'Đã duyệt' AND Ngay_duyet > @since)`;
    } else {
      // Nếu không có since, mặc định lấy Đã duyệt trong ngày hôm nay
      query += ` OR (Trang_thai_duyet = N'Đã duyệt' AND CAST(Ngay_duyet AS DATE) = CAST(GETDATE() AS DATE))`;
    }
    
    const result = await req.query(query);
    
    // Trả về danh sách để Client tự map
    return NextResponse.json(result.recordset);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
