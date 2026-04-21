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
  return handleFetch(req);
}

export async function POST(req: NextRequest) {
  return handleFetch(req);
}

async function handleFetch(req: NextRequest) {
  try {
    let quyenDL = '';
    let checkOnly = false;

    if (req.method === 'POST') {
      const body = await req.json();
      quyenDL = body.quyen_dl || '';
      checkOnly = body.checkOnly === true;
    } else {
      quyenDL = req.nextUrl.searchParams.get('quyen_dl') || '';
      checkOnly = req.nextUrl.searchParams.get('checkOnly') === 'true';
    }

    const areas = parseQuyenDL(quyenDL);
    if (areas.length === 0) {
      return NextResponse.json({ error: 'Không có quyền dữ liệu' }, { status: 403 });
    }

    const db = await connectToDB();

    // Lấy ngày cập nhật mới nhất
    const resNgay = await db.query('SELECT TOP(1) [Ngay_Update] FROM Web_NgayUpdate');
    const serverNgayUpdate = resNgay.recordset[0]?.['Ngay_Update'] ?? null;

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
