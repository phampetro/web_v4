import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

function parseQuyenDL(raw: string): string[] {
  if (!raw) return [];
  return raw.split('-').map(s => s.trim()).filter(Boolean);
}

/**
 * GET - Lấy danh sách đăng ký chỉnh tuyến
 */
export async function GET(req: NextRequest) {
  try {
    const quyenDL = req.nextUrl.searchParams.get('quyen_dl') || '';
    const areas = parseQuyenDL(quyenDL);
    if (areas.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = await connectToDB();
    const request = db.request();
    
    const placeholders = areas.map((area, i) => {
      const p = `area${i}`;
      request.input(p, area);
      return `@${p}`;
    });

    const result = await request.query(`
      SELECT * FROM tbl_dangky_chinhtuyen
      WHERE Khu_vuc IN (${placeholders.join(',')})
      ORDER BY Ngay_dang_ky DESC
    `);

    return NextResponse.json({ data: result.recordset });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

/**
 * POST - Đăng ký chỉnh tuyến
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows, nguoi_dang_ky } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu' }, { status: 400 });
    }

    const db = await connectToDB();

    for (const r of rows) {
      const requestCheck = db.request();
      requestCheck.input('ma_kh', sql.NVarChar(50), r.Ma_KH);
      const checkRes = await requestCheck.query(`
        SELECT TOP 1 ID FROM tbl_dangky_chinhtuyen 
        WHERE Ma_KH = @ma_kh AND Trang_thai_duyet = N'Chờ duyệt'
        ORDER BY Ngay_dang_ky DESC
      `);
      
      const existingID = checkRes.recordset[0]?.ID;

      const request = db.request();
      request.input('khu_vuc', sql.NVarChar(100), r.Khu_vuc || '');
      request.input('ma_kh', sql.NVarChar(50), r.Ma_KH || '');
      request.input('ten_kh', sql.NVarChar(200), r.Ten_KH || '');
      request.input('dc', sql.NVarChar(500), r.DC || '');
      request.input('nvbh_cu', sql.NVarChar(200), r.Ma_ten_nvbh_CU || '');
      request.input('thu_cu', sql.NVarChar(100), r.Thu_CU || '');
      request.input('ts_cu', sql.NVarChar(50), r.Tan_suat_CU || '');
      request.input('nvbh_moi', sql.NVarChar(200), r.Ma_ten_nvbh_MOI || '');
      request.input('thu_moi', sql.NVarChar(100), r.Thu_MOI || '');
      request.input('ts_moi', sql.NVarChar(50), r.Tan_suat_MOI || '');
      request.input('nguoi_dk', sql.NVarChar(100), nguoi_dang_ky || '');

      if (existingID) {
        // Cập nhật đơn đang chờ
        request.input('id', sql.BigInt, existingID);
        await request.query(`
          UPDATE tbl_dangky_chinhtuyen
          SET Ma_ten_nvbh_MOI = @nvbh_moi,
              Thu_MOI = @thu_moi,
              Tan_suat_MOI = @ts_moi,
              Nguoi_dang_ky = @nguoi_dk,
              Ngay_dang_ky = DATEADD(hour, 7, GETUTCDATE())
          WHERE ID = @id
        `);
      } else {
        // Tạo đơn mới
        await request.query(`
          INSERT INTO tbl_dangky_chinhtuyen
            (Khu_vuc, Ma_KH, Ten_KH, DC, Ma_ten_nvbh_CU, Thu_CU, Tan_suat_CU, Ma_ten_nvbh_MOI, Thu_MOI, Tan_suat_MOI, Nguoi_dang_ky, Ngay_dang_ky, Trang_thai_duyet)
          VALUES
            (@khu_vuc, @ma_kh, @ten_kh, @dc, @nvbh_cu, @thu_cu, @ts_cu, @nvbh_moi, @thu_moi, @ts_moi, @nguoi_dk, DATEADD(hour, 7, GETUTCDATE()), N'Chờ duyệt')
        `);
      }
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

/**
 * PATCH - Duyệt / Từ chối chỉnh tuyến
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, trang_thai, nguoi_duyet } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Chưa chọn bản ghi nào' }, { status: 400 });
    }

    const db = await connectToDB();
    const request = db.request();
    request.input('trang_thai', sql.NVarChar(50), trang_thai);
    request.input('nguoi_duyet', sql.NVarChar(100), nguoi_duyet || '');

    const placeholders = ids.map((id: any, i: number) => {
      const p = `id${i}`;
      request.input(p, sql.BigInt, Number(id));
      return `@${p}`;
    });

    const result = await request.query(`
      UPDATE tbl_dangky_chinhtuyen
      SET Trang_thai_duyet = @trang_thai,
          Nguoi_duyet = @nguoi_duyet,
          Ngay_duyet = DATEADD(hour, 7, GETUTCDATE())
      WHERE ID IN (${placeholders.join(',')})
    `);

    return NextResponse.json({ success: true, updated: result.rowsAffected[0] });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

/**
 * DELETE - Xóa yêu cầu đăng ký chỉnh tuyến (chỉ khi đang chờ duyệt)
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Chưa chọn bản ghi nào' }, { status: 400 });
    }

    const db = await connectToDB();
    const request = db.request();

    const placeholders = ids.map((id: any, i: number) => {
      const p = `id${i}`;
      request.input(p, sql.BigInt, Number(id));
      return `@${p}`;
    });

    const result = await request.query(`
      DELETE FROM tbl_dangky_chinhtuyen
      WHERE ID IN (${placeholders.join(',')})
      AND Trang_thai_duyet = N'Chờ duyệt'
    `);

    return NextResponse.json({ success: true, deleted: result.rowsAffected[0] });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
