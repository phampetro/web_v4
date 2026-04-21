import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

// Lấy danh sách yêu cầu để duyệt
export async function GET() {
  try {
    const pool = await connectToDB();
    const result = await pool.request().query(`
      SELECT * FROM tbl_dangky_chopho 
      ORDER BY 
        CASE WHEN Trang_thai_duyet = N'Chờ duyệt' THEN 0 ELSE 1 END,
        Ngay_dang_ky DESC
    `);
    return NextResponse.json({ data: result.recordset });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Thực hiện duyệt hoặc từ chối (Chỉ cập nhật bảng đăng ký)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids, action, user_duyet, note } = body; 

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No items selected' }, { status: 400 });
    }

    const pool = await connectToDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const status = action === 'Approve' ? 'Đã duyệt' : 'Từ chối';
      
      for (const id of ids) {
        const sqlReq = new sql.Request(transaction);
        await sqlReq
          .input('ID', sql.Int, id)
          .input('Status', sql.NVarChar, status)
          .input('User', sql.NVarChar, user_duyet || 'Manager')
          .input('Note', sql.NVarChar, note || '')
          .query(`
            UPDATE tbl_dangky_chopho 
            SET Trang_thai_duyet = @Status, 
                Ngay_duyet = GETDATE(), 
                Nguoi_duyet = @User,
                Ghi_chu = @Note
            WHERE ID = @ID
          `);
      }
      
      await transaction.commit();
      return NextResponse.json({ success: true });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error: any) {
    console.error('Approve Cho-Pho Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
