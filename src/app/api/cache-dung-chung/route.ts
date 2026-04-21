import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 });
    }

    const db = await connectToDB();

    // Tối ưu: Chạy song song việc lấy Ngày Update và Thông tin User
    const [resNgay, resUser] = await Promise.all([
      db.query('SELECT TOP(1) [Ngay_Update] FROM Web_NgayUpdate'),
      db.query`SELECT Quyen_QL, Quyen FROM UserInfo WHERE ID = ${username}`
    ]);

    const ngayUpdate = resNgay.recordset[0]?.['Ngay_Update'] ?? null;
    const quyenDL = resUser.recordset[0]?.Quyen_QL || '';
    const quyenUser = resUser.recordset[0]?.Quyen || '';

    let khuVucList: string[] = [];
    let nvbhList: { MA_TEN_NVBH: string, TEN_KHUVUC: string }[] = [];

    // Tối ưu hóa việc xử lý chuỗi và truy vấn danh mục
    if (quyenDL) {
      const parts = quyenDL.split(/[,-]/)
        .map((p: string) => p.replace(/["']/g, '').trim())
        .filter(Boolean);

      // Lấy Khu vực TRỰC TIẾP từ Quyen_QL để đảm bảo đủ tỉnh
      khuVucList = [...new Set<string>(parts)].sort();

      const formattedQuyenDL = parts.map((p: string) => `N'${p}'`).join(',');

      if (formattedQuyenDL) {
        try {
          const resTuyen = await db.query(`
            SELECT DISTINCT MA_TEN_NVBH, TEN_KHUVUC 
            FROM tbl_tuyen_dv_us 
            WHERE TEN_KHUVUC IN (${formattedQuyenDL})
          `);

          nvbhList = resTuyen.recordset
            .map((r: any) => ({
              MA_TEN_NVBH: r.MA_TEN_NVBH?.trim() || '',
              TEN_KHUVUC: r.TEN_KHUVUC?.trim() || ''
            }))
            .filter((item: any) => item.MA_TEN_NVBH)
            .sort((a: any, b: any) => a.MA_TEN_NVBH.localeCompare(b.MA_TEN_NVBH));
        } catch (sqlErr) {
          console.error('SQL Sub-query Error for NVBH:', sqlErr);
        }
      }
    }

    return NextResponse.json({
      ngayUpdate,
      quyenDL,
      quyen: quyenUser,
      khuVucList,
      nvbhList
    });
  } catch (e) {
    console.error('API Init Error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
