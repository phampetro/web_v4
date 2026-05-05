import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';
import { getAuthUser } from '@/lib/auth-guard';

function parseQuyenDL(raw: string): string[] {
  if (!raw) return [];
  return raw.split('-').map(s => s.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const authResult = getAuthUser(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json().catch(() => ({}));
    
    // Nếu có rows là đăng ký mới
    if (body.rows) {
      return handleRegister(body);
    }
    
    // Ngược lại là lấy dữ liệu (Fetch)
    return handleFetch(body);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Lỗi xử lý dữ liệu' }, { status: 400 });
  }
}

async function handleFetch(body: any) {
  try {
    const quyenDL = body.quyen_dl || '';
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
    console.error('Fetch error:', e);
    return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu' }, { status: 500 });
  }
}

async function handleRegister(body: any) {
  try {
    const { rows, nguoi_dang_ky } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu' }, { status: 400 });
    }

    const db = await connectToDB();

    // Phân loại: Mới vs Gửi lại (Bị từ chối)
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

    // 1. Insert mới
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

    // 2. Cập nhật lại (Duyệt lại)
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
      updated: resubmitRows.length 
    });
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu' }, { status: 500 });
  }
}

/**
 * PATCH - Manager duyệt / từ chối đăng ký điều chỉnh tuyến
 */
export async function PATCH(req: NextRequest) {
  try {
    const authResult = getAuthUser(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const { ids, trang_thai, nguoi_duyet } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Chưa chọn bản ghi nào' }, { status: 400 });
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
    console.error('PATCH dieu-chinh error:', e);
    return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
