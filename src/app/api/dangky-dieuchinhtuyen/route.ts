import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

function parseQuyenDL(raw: string): string[] {
  if (!raw) return [];
  return raw.split('-').map(s => s.trim()).filter(Boolean);
}

/**
 * POST - Đăng ký điều chỉnh tuyến
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows, nguoi_dang_ky } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu' }, { status: 400 });
    }

    const db = await connectToDB();

    // 1. Kiểm tra tồn tại để phân loại (Trùng nhưng Từ chối thì cho ĐK lại)
    const maKHs = rows.map((r: any) => r.Ma_KH).filter(Boolean);
    let existingRecords: any[] = [];
    
    if (maKHs.length > 0) {
      const requestCheck = db.request();
      const placeholders = maKHs.map((ma: string, i: number) => {
        const p = `ma${i}`;
        requestCheck.input(p, sql.NVarChar(50), ma);
        return `@${p}`;
      });
      
      const checkRes = await requestCheck.query(`
        SELECT Ma_KH, Trang_thai_duyet FROM tbl_dangky_chinhtuyen 
        WHERE Ma_KH IN (${placeholders.join(',')})
      `);
      existingRecords = checkRes.recordset;
    }

    const rejectedMaKHs = new Set(existingRecords.filter(r => r.Trang_thai_duyet === 'Từ chối').map(r => r.Ma_KH));
    const ignoredMaKHs = new Set(existingRecords.filter(r => r.Trang_thai_duyet !== 'Từ chối').map(r => r.Ma_KH));
    
    const newRows = rows.filter((r: any) => !ignoredMaKHs.has(r.Ma_KH) && !rejectedMaKHs.has(r.Ma_KH));
    const resubmitRows = rows.filter((r: any) => rejectedMaKHs.has(r.Ma_KH));

    // 2. Insert mới
    for (const r of newRows) {
      const request = db.request();
      request.input('khu_vuc', sql.NVarChar(100), r.Khu_vuc || '');
      request.input('ma_kh', sql.NVarChar(50), r.Ma_KH || '');
      request.input('ten_kh', sql.NVarChar(255), r.Ten_KH || '');
      request.input('dc', sql.NVarChar(500), r.DC || '');
      request.input('nvbh_cu', sql.NVarChar(255), r.Ma_ten_nvbh_CU || '');
      request.input('thu_cu', sql.NVarChar(100), r.Thu_CU || '');
      request.input('ts_cu', sql.NVarChar(50), r.Tan_suat_CU || '');
      request.input('nvbh_moi', sql.NVarChar(255), r.Ma_ten_nvbh_MOI || '');
      request.input('thu_moi', sql.NVarChar(100), r.Thu_MOI || '');
      request.input('ts_moi', sql.NVarChar(50), r.Tan_suat_MOI || '');
      request.input('nguoi_dk', sql.NVarChar(100), nguoi_dang_ky || '');

      await request.query(`
        INSERT INTO tbl_dangky_chinhtuyen
          (Khu_vuc, Ma_KH, Ten_KH, DC, Ma_ten_nvbh_CU, Thu_CU, Tan_suat_CU, Ma_ten_nvbh_MOI, Thu_MOI, Tan_suat_MOI, Nguoi_dang_ky, Ngay_dang_ky)
        VALUES
          (@khu_vuc, @ma_kh, @ten_kh, @dc, @nvbh_cu, @thu_cu, @ts_cu, @nvbh_moi, @thu_moi, @ts_moi, @nguoi_dk, DATEADD(hour, 7, GETUTCDATE()))
      `);
    }

    // 3. Cập nhật lại (Duyệt lại)
    for (const r of resubmitRows) {
      const request = db.request();
      request.input('ma_kh', sql.NVarChar(50), r.Ma_KH);
      request.input('nvbh_moi', sql.NVarChar(255), r.Ma_ten_nvbh_MOI || '');
      request.input('thu_moi', sql.NVarChar(100), r.Thu_MOI || '');
      request.input('ts_moi', sql.NVarChar(50), r.Tan_suat_MOI || '');
      request.input('nguoi_dk', sql.NVarChar(100), nguoi_dang_ky || '');

      await request.query(`
        UPDATE tbl_dangky_chinhtuyen
        SET Trang_thai_duyet = N'Chờ duyệt',
            Ma_ten_nvbh_MOI = @nvbh_moi,
            Thu_MOI = @thu_moi,
            Tan_suat_MOI = @ts_moi,
            Nguoi_dang_ky = @nguoi_dk,
            Ngay_dang_ky = DATEADD(hour, 7, GETUTCDATE()),
            Ngay_duyet = NULL
        WHERE Ma_KH = @ma_kh
      `);
    }

    return NextResponse.json({ 
      success: true, 
      inserted: newRows.length, 
      updated: resubmitRows.length,
      ignored: existingRecords.filter(r => r.Trang_thai_duyet !== 'Từ chối')
    });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

/**
 * GET - Lấy danh sách đăng ký điều chỉnh
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

export const dynamic = 'force-dynamic';
