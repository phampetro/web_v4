import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';

/**
 * Chuẩn hóa Quyen_DL: "Gò Vấp-Quận 12-Quận 3,10, 11" → ['Gò Vấp', 'Quận 12', 'Quận 3,10, 11']
 */
function parseQuyenDL(raw: string): string[] {
  if (!raw) return [];
  return raw.split('-').map(s => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const quyenDL = req.nextUrl.searchParams.get('quyen_dl') || '';
    const areas = parseQuyenDL(quyenDL);
    if (areas.length === 0) {
      return NextResponse.json({ error: 'Không có quyền dữ liệu' }, { status: 403 });
    }

    const checkOnly = req.nextUrl.searchParams.get('checkOnly') === 'true';

    const db = await connectToDB();

    // Lấy ngày cập nhật mới nhất
    const resNgay = await db.query('SELECT TOP(1) [Ngày_Update] FROM view_ReportVBA_NgayUpdate');
    const serverNgayUpdate = resNgay.recordset[0]?.['Ngày_Update'] ?? null;

    if (checkOnly) {
      return NextResponse.json({ ngayUpdate: serverNgayUpdate });
    }

    // Tạo tham số WHERE IN động
    const request = db.request();
    const placeholders: string[] = [];
    areas.forEach((area, i) => {
      const paramName = `area${i}`;
      request.input(paramName, area);
      placeholders.push(`@${paramName}`);
    });

    const query = `SELECT * FROM ReportVBA_KH_KDS_WEB WHERE [Khu_vực] IN (${placeholders.join(',')}) ORDER BY [Khu_vực], [Mã_Tên_NVBH], [Mã_KH], [Tần_Suất], [Thứ]`;
    const result = await request.query(query);

    return NextResponse.json({ data: result.recordset, ngayUpdate: serverNgayUpdate });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
