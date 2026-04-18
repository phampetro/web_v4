import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

/**
 * Chuẩn hóa Quyen_DL: "Gò Vấp-Quận 12-Quận 3,10, 11" → ['Gò Vấp', 'Quận 12', 'Quận 3,10, 11']
 */
function parseQuyenDL(raw: string): string[] {
  if (!raw) return [];
  return raw.split('-').map(s => s.trim()).filter(Boolean);
}

/**
 * POST - NVBH đăng ký tạm ngưng KH
 * Body: { rows: [...], nguoi_dang_ky: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows, nguoi_dang_ky } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu KH' }, { status: 400 });
    }

    const db = await connectToDB();

    // 1. Kiểm tra các KH đã tồn tại
    const maKHs = rows.map((r: any) => r.Ma_KH).filter(Boolean);
    let existingRecords: any[] = [];
    
    if (maKHs.length > 0) {
      const requestCheck = db.request();
      const placeholders = maKHs.map((ma: string, i: number) => {
        const p = `ma${i}`;
        requestCheck.input(p, sql.NVarChar(50), ma);
        return `@${p}`;
      });
      
      const checkQuery = `
        SELECT Ma_KH, Ten_KH, Trang_thai_duyet 
        FROM tbl_dangky_tamngung_kh 
        WHERE Ma_KH IN (${placeholders.join(',')})
      `;
      const checkRes = await requestCheck.query(checkQuery);
      existingRecords = checkRes.recordset;
    }

    // Phân loại: KH trùng nhưng đang 'Từ chối' -> sẽ được xin duyệt lại
    const rejectedRecords = existingRecords.filter(r => r.Trang_thai_duyet === 'Từ chối');
    const ignoredRecords = existingRecords.filter(r => r.Trang_thai_duyet !== 'Từ chối');
    
    const ignoredMaKHs = new Set(ignoredRecords.map(r => r.Ma_KH));
    const rejectedMaKHs = new Set(rejectedRecords.map(r => r.Ma_KH));
    
    const newRows = rows.filter((r: any) => !ignoredMaKHs.has(r.Ma_KH) && !rejectedMaKHs.has(r.Ma_KH));

    // 2. Insert những KH chưa tồn tại
    for (const r of newRows) {
      const request = db.request();
      request.input('khu_vuc', sql.NVarChar(100), r.Khu_vuc || '');
      request.input('ma_ten_nvbh', sql.NVarChar(200), r.Ma_ten_nvbh || '');
      request.input('ma_kh', sql.NVarChar(50), r.Ma_KH || '');
      request.input('ten_kh', sql.NVarChar(200), r.Ten_KH || '');
      request.input('dc', sql.NVarChar(500), r.DC || '');
      request.input('thu', sql.NVarChar(20), r.Thu || '');
      request.input('tan_suat', sql.NVarChar(50), r.Tan_suat || '');
      request.input('nguoi_dang_ky', sql.NVarChar(100), nguoi_dang_ky || '');

      await request.query(`
        INSERT INTO tbl_dangky_tamngung_kh
          (Khu_vuc, Ma_ten_nvbh, Ma_KH, Ten_KH, DC, Thu, Tan_suat, Nguoi_dang_ky, Ngay_dang_ky)
        VALUES
          (@khu_vuc, @ma_ten_nvbh, @ma_kh, @ten_kh, @dc, @thu, @tan_suat, @nguoi_dang_ky, DATEADD(hour, 7, GETUTCDATE()))
      `);
    }

    // 3. Update trạng thái lại thành 'Chờ duyệt' cho những KH đã bị 'Từ chối'
    if (rejectedRecords.length > 0) {
      const updateRequest = db.request();
      updateRequest.input('nguoi_dang_ky', sql.NVarChar(100), nguoi_dang_ky || '');
      
      const updatePlaceholders = rejectedRecords.map((r, i) => {
        const p = `upd_ma${i}`;
        updateRequest.input(p, sql.NVarChar(50), r.Ma_KH);
        return `@${p}`;
      });
      
      await updateRequest.query(`
        UPDATE tbl_dangky_tamngung_kh
        SET Trang_thai_duyet = N'Chờ duyệt',
            Ngay_dang_ky = DATEADD(hour, 7, GETUTCDATE()),
            Ngay_duyet = NULL,
            Nguoi_dang_ky = @nguoi_dang_ky
        WHERE Ma_KH IN (${updatePlaceholders.join(',')})
      `);
    }

    return NextResponse.json({ 
      success: true, 
      inserted: newRows.length,
      updated: rejectedRecords.length,
      ignored: ignoredRecords,
      resubmitted: rejectedRecords
    });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

/**
 * GET - Manager xem danh sách đăng ký tạm ngưng
 * Query: ?quyen_dl=...
 */
export async function GET(req: NextRequest) {
  try {
    const quyenDL = req.nextUrl.searchParams.get('quyen_dl') || '';
    const areas = parseQuyenDL(quyenDL);
    if (areas.length === 0) {
      return NextResponse.json({ error: 'Không có quyền dữ liệu' }, { status: 403 });
    }

    const db = await connectToDB();
    const request = db.request();
    const placeholders: string[] = [];
    areas.forEach((area, i) => {
      const paramName = `area${i}`;
      request.input(paramName, area);
      placeholders.push(`@${paramName}`);
    });

    const query = `
      SELECT * FROM tbl_dangky_tamngung_kh
      WHERE Khu_vuc IN (${placeholders.join(',')})
      ORDER BY Ngay_dang_ky DESC
    `;
    const result = await request.query(query);

    return NextResponse.json({ data: result.recordset });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
