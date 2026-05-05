import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';
import { getAuthUser } from '@/lib/auth-guard';

export async function POST(request: Request) {
  try {
    const authResult = getAuthUser(request as any);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { requests, nguoi_dang_ky } = body;

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json({ success: true, message: 'No requests to send' });
    }

    const pool = await connectToDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const req of requests) {
        const sqlReq = new sql.Request(transaction);

        // Kiểm tra xem có yêu cầu nào đang chờ duyệt không
        const checkRes = await sqlReq
          .input('MaKH_Check', sql.NVarChar, req.maKH)
          .query(`SELECT ID FROM tbl_dangky_chopho WHERE Ma_KH = @MaKH_Check AND Trang_thai_duyet = N'Chờ duyệt'`);

        const existingId = checkRes.recordset[0]?.ID;

        const saveReq = new sql.Request(transaction);
        saveReq
          .input('MaKH', sql.NVarChar, req.maKH)
          .input('TenKH', sql.NVarChar, req.tenKH)
          .input('OldVal', sql.NVarChar, req.oldVal)
          .input('NewVal', sql.NVarChar, req.newVal)
          .input('KhuVuc', sql.NVarChar, req.khuVuc)
          .input('NVBH', sql.NVarChar, req.nvbh)
          .input('DiaChi', sql.NVarChar, req.diaChi)
          .input('Thu', sql.NVarChar, req.thu)
          .input('User', sql.NVarChar, nguoi_dang_ky || '');

        if (existingId) {
          // UPDATE yêu cầu cũ đang chờ duyệt
          await saveReq
            .input('ID', sql.Int, existingId)
            .query(`
              UPDATE tbl_dangky_chopho 
              SET Gia_tri_moi = @NewVal, 
                  Ngay_dang_ky = DATEADD(hour, 7, GETUTCDATE()), 
                  Nguoi_dang_ky = @User,
                  Ghi_chu = NULL -- Reset ghi chú nếu có
              WHERE ID = @ID
            `);
        } else {
          // INSERT yêu cầu mới
          await saveReq.query(`
            INSERT INTO tbl_dangky_chopho (
              Ma_KH, Ten_KH, Gia_tri_cu, Gia_tri_moi, Khu_vuc, NVBH, Dia_chi, Thu,
              Nguoi_dang_ky, Ngay_dang_ky, Trang_thai_duyet
            )
            VALUES (
              @MaKH, @TenKH, @OldVal, @NewVal, @KhuVuc, @NVBH, @DiaChi, @Thu,
              @User, DATEADD(hour, 7, GETUTCDATE()), N'Chờ duyệt'
            )
          `);
        }
      }

      await transaction.commit();
      return NextResponse.json({ success: true, count: requests.length });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error: any) {
    console.error('API Save Cho-Pho Error:', error);
    return NextResponse.json({ error: 'Lỗi xử lý dữ liệu' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = getAuthUser(request as any);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Không có bản ghi nào để xóa' }, { status: 400 });
    }

    const pool = await connectToDB();
    const sqlReq = new sql.Request(pool);

    const placeholders = ids.map((id: number, i: number) => {
      const p = `id${i}`;
      sqlReq.input(p, sql.Int, id);
      return `@${p}`;
    });

    const result = await sqlReq.query(`
      DELETE FROM tbl_dangky_chopho 
      WHERE ID IN (${placeholders.join(',')}) AND Trang_thai_duyet = N'Chờ duyệt'
    `);

    return NextResponse.json({ success: true, deletedCount: result.rowsAffected[0] });
  } catch (error: any) {
    console.error('API Delete Cho-Pho Error:', error);
    return NextResponse.json({ error: 'Lỗi xử lý dữ liệu' }, { status: 500 });
  }
}
