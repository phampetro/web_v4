import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

function parseQuyenDL(raw: string): string[] {
  if (!raw) return [];
  return raw.split('-').map(s => s.trim()).filter(Boolean);
}

/**
 * GET - Lấy danh sách đăng ký tạm ngưng
 */
export async function GET(req: NextRequest) {
  return handleFetch(req);
}

export async function POST(req: NextRequest) {
  // Phân biệt: Nếu có 'rows' thì là Đăng ký (Logic cũ), nếu không có 'rows' mà có 'quyen_dl' thì là Lấy dữ liệu (Fetch)
  try {
    const body = await req.json();
    if (body.rows) {
      return handleRegister(body);
    }
    return handleFetch(req, body);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

async function handleFetch(req: NextRequest, body?: any) {
  try {
    let quyenDL = '';
    let checkOnly = false;

    if (req.method === 'POST' && body) {
      quyenDL = body.quyen_dl || '';
      checkOnly = body.checkOnly === true;
    } else {
      quyenDL = req.nextUrl.searchParams.get('quyen_dl') || '';
      checkOnly = req.nextUrl.searchParams.get('checkOnly') === 'true';
    }

    const areas = parseQuyenDL(quyenDL);
    if (areas.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = await connectToDB();
    
    // Lấy ngày cập nhật mới nhất từ bản ghi cuối cùng
    const resNgay = await db.query(`
      SELECT TOP(1) Ngay_dang_ky as lastUpdate 
      FROM tbl_dangky_tamngung_kh 
      ORDER BY Ngay_dang_ky DESC
    `);
    const serverNgayUpdate = resNgay.recordset[0]?.lastUpdate ? new Date(resNgay.recordset[0].lastUpdate).toISOString() : null;

    if (checkOnly) {
      return NextResponse.json({ ngayUpdate: serverNgayUpdate });
    }

    const request = db.request();
    const placeholders = areas.map((area, i) => {
      const p = `area${i}`;
      request.input(p, area);
      return `@${p}`;
    });

    const result = await request.query(`
      SELECT * FROM tbl_dangky_tamngung_kh
      WHERE Khu_vuc IN (${placeholders.join(',')})
      ORDER BY Ngay_dang_ky DESC
    `);

    return NextResponse.json({ data: result.recordset, ngayUpdate: serverNgayUpdate });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

async function handleRegister(body: any) {
  try {
    const { rows, nguoi_dang_ky } = body;
    const db = await connectToDB();

    // 1. Kiểm tra tồn tại
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
        SELECT Ma_KH, Trang_thai_duyet FROM tbl_dangky_tamngung_kh 
        WHERE Ma_KH IN (${placeholders.join(',')})
      `);
      existingRecords = checkRes.recordset;
    }

    const rejectedMaKHs = new Set(existingRecords.filter(r => r.Trang_thai_duyet === 'Từ chối').map(r => r.Ma_KH));
    const ignoredMaKHs = new Set(existingRecords.filter(r => r.Trang_thai_duyet !== 'Từ chối').map(r => r.Ma_KH));
    
    const newRows = rows.filter((r: any) => !ignoredMaKHs.has(r.Ma_KH) && !rejectedMaKHs.has(r.Ma_KH));
    const resubmitMaKHs = existingRecords.filter(r => r.Trang_thai_duyet === 'Từ chối').map(r => r.Ma_KH);

    // 2. Insert mới
    for (const r of newRows) {
      const request = db.request();
      request.input('khu_vuc', sql.NVarChar(100), r.Khu_vuc || '');
      request.input('ma_ten_nvbh', sql.NVarChar(200), r.Ma_ten_nvbh || '');
      request.input('ma_kh', sql.NVarChar(50), r.Ma_KH || '');
      request.input('ten_kh', sql.NVarChar(200), r.Ten_KH || '');
      request.input('dc', sql.NVarChar(500), r.DC || '');
      request.input('thu', sql.NVarChar(20), r.Thu || '');
      request.input('tan_suat', sql.NVarChar(50), r.Tan_suat || '');
      request.input('nguoi_dk', sql.NVarChar(100), nguoi_dang_ky || '');

      await request.query(`
        INSERT INTO tbl_dangky_tamngung_kh
          (Khu_vuc, Ma_ten_nvbh, Ma_KH, Ten_KH, DC, Thu, Tan_suat, Nguoi_dang_ky, Ngay_dang_ky)
        VALUES
          (@khu_vuc, @ma_ten_nvbh, @ma_kh, @ten_kh, @dc, @thu, @tan_suat, @nguoi_dk, DATEADD(hour, 7, GETUTCDATE()))
      `);
    }

    // 3. Gửi lại (Bị từ chối trước đó)
    if (resubmitMaKHs.length > 0) {
      const updateRequest = db.request();
      updateRequest.input('nguoi_dk', sql.NVarChar(100), nguoi_dang_ky || '');
      const updatePlaceholders = resubmitMaKHs.map((ma, i) => {
        const p = `upd_ma${i}`;
        updateRequest.input(p, sql.NVarChar(50), ma);
        return `@${p}`;
      });
      
      await updateRequest.query(`
        UPDATE tbl_dangky_tamngung_kh
        SET Trang_thai_duyet = N'Chờ duyệt',
            Ngay_dang_ky = DATEADD(hour, 7, GETUTCDATE()),
            Ngay_duyet = NULL,
            Nguoi_dang_ky = @nguoi_dk
        WHERE Ma_KH IN (${updatePlaceholders.join(',')})
      `);
    }

    return NextResponse.json({ 
      success: true, 
      inserted: newRows.length,
      updated: resubmitMaKHs.length,
      ignored: existingRecords.filter(r => r.Trang_thai_duyet !== 'Từ chối')
    });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

/**
 * PATCH - Manager duyệt / từ chối tạm ngưng
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
      request.input(p, sql.BigInt, id);
      return `@${p}`;
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
    console.error('PATCH tam-ngung error:', e);
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

/**
 * DELETE - Xóa yêu cầu đăng ký tạm ngưng (chỉ khi đang chờ duyệt)
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
      request.input(p, sql.BigInt, id);
      return `@${p}`;
    });

    // Chỉ cho phép xóa các đơn đang ở trạng thái 'Chờ duyệt'
    const query = `
      DELETE FROM tbl_dangky_tamngung_kh
      WHERE ID IN (${placeholders.join(',')})
      AND Trang_thai_duyet = N'Chờ duyệt'
    `;
    const result = await request.query(query);

    return NextResponse.json({
      success: true,
      deleted: result.rowsAffected[0],
    });
  } catch (e) {
    console.error('DELETE tam-ngung error:', e);
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
