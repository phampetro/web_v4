import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

/**
 * POST - Manager duyệt / từ chối đăng ký điều chỉnh tuyến
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, trang_thai, nguoi_duyet } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Chưa chọn bản ghi nào' }, { status: 400 });
    }

    if (!['Đã duyệt', 'Từ chối'].includes(trang_thai)) {
      return NextResponse.json({ error: 'Trạng thái không hợp lệ' }, { status: 400 });
    }

    const db = await connectToDB();
    const request = db.request();
    request.input('trang_thai', sql.NVarChar(50), trang_thai);
    request.input('nguoi_duyet', sql.NVarChar(100), nguoi_duyet || '');

    const placeholders = ids.map((id: number, i: number) => {
      const p = `id${i}`;
      request.input(p, sql.Int, id);
      return `@${p}`;
    });

    const query = `
      UPDATE tbl_dangky_chinhtuyen
      SET Trang_thai_duyet = @trang_thai,
          Nguoi_duyet = @nguoi_duyet,
          Ngay_duyet = DATEADD(hour, 7, GETUTCDATE())
      WHERE ID IN (${placeholders.join(',')})
    `;
    const result = await request.query(query);

    return NextResponse.json({
      success: true,
      updated: result.rowsAffected[0],
      trang_thai,
    });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
