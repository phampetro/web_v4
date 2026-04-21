import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const username = cookieStore.get('username')?.value || '';

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
          .input('User', sql.NVarChar, nguoi_dang_ky || username);

        if (existingId) {
          // UPDATE yêu cầu cũ đang chờ duyệt
          await saveReq
            .input('ID', sql.Int, existingId)
            .query(`
              UPDATE tbl_dangky_chopho 
              SET Gia_tri_moi = @NewVal, 
                  Ngay_dang_ky = GETDATE(), 
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
              @User, GETDATE(), N'Chờ duyệt'
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
