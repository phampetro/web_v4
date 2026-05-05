import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';
import { getAuthUser } from '@/lib/auth-guard';

// Gộp chung Fetch và Action vào một endpoint POST
export async function POST(req: NextRequest) {
  try {
    const authResult = getAuthUser(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json().catch(() => ({}));
    
    // Nếu có ids và action thì là hành động duyệt/từ chối
    if (body.action && body.ids) {
      return handleApprove(body);
    }
    
    // Ngược lại là fetch data
    return handleFetch();
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu' }, { status: 500 });
  }
}

// Lấy danh sách yêu cầu để duyệt
async function handleFetch() {
  const pool = await connectToDB();
  const result = await pool.request().query(`
    SELECT * FROM tbl_dangky_chopho 
    ORDER BY 
      CASE WHEN Trang_thai_duyet = N'Chờ duyệt' THEN 0 ELSE 1 END,
      Ngay_dang_ky DESC
  `);
  return NextResponse.json({ data: result.recordset });
}

// Thực hiện duyệt hoặc từ chối
async function handleApprove(body: any) {
  const { ids, action, user_duyet, note } = body; 

  if (!Array.isArray(ids) || ids.length === 0) {
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
              Ngay_duyet = DATEADD(hour, 7, GETUTCDATE()), 
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
}
