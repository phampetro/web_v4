import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

/**
 * POST - Manager duyệt / từ chối đăng ký tạm ngưng
 * Body: { ids: number[], trang_thai: 'Đã duyệt' | 'Từ chối' }
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

    // Tạo parameterized placeholders cho IDs
    const placeholders: string[] = [];
    ids.forEach((id: number, i: number) => {
      const paramName = `id${i}`;
      request.input(paramName, sql.Int, id);
      placeholders.push(`@${paramName}`);
    });

    const query = `
      UPDATE tbl_dangky_tamngung_kh
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
