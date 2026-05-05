import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';
import { getAuthUser } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  try {
    const authResult = getAuthUser(req);
    if (authResult instanceof NextResponse) return authResult;
    const username = authResult; // username từ session token

    const body = await req.json().catch(() => ({}));

    // Nếu có products là action lưu cấu hình
    if (body.products) {
      return handleSaveConfig(username, body.products);
    }
    
    // Ngược lại là fetch data
    return handleFetch(username);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu' }, { status: 500 });
  }
}

async function handleFetch(username: string) {
  const pool = await connectToDB();

  // 1. Lấy tất cả sản phẩm gốc
  const allProductsResult = await pool.request().query('SELECT MA_SPQD, MAX(TEN_SPQD) as TEN_SPQD FROM tbl_SanPhamDistinct GROUP BY MA_SPQD ORDER BY MA_SPQD');

  // 2. Lấy cấu hình hiện tại của User
  const userConfigResult = await pool.request()
    .input('Username', sql.NVarChar, username)
    .query('SELECT MA_SPQD, TEN_SPQD, Username, Thu_tu_sap_xep FROM tbl_danhsach_sp_baophu WHERE Username = @Username ORDER BY Thu_tu_sap_xep');

  return NextResponse.json({
    allProducts: allProductsResult.recordset,
    userConfig: userConfigResult.recordset
  });
}

async function handleSaveConfig(username: string, products: any[]) {
  const pool = await connectToDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Xóa cấu hình cũ của User
    await transaction.request()
      .input('Username', sql.NVarChar, username)
      .query('DELETE FROM tbl_danhsach_sp_baophu WHERE Username = @Username');

    // 2. Chèn danh sách mới
    if (products && products.length > 0) {
      for (const item of products) {
        await transaction.request()
          .input('MA_SPQD', sql.NVarChar, item.MA_SPQD)
          .input('TEN_SPQD', sql.NVarChar, item.TEN_SPQD)
          .input('Username', sql.NVarChar, username)
          .input('Thu_tu_sap_xep', sql.Int, item.Thu_tu_sap_xep)
          .query('INSERT INTO tbl_danhsach_sp_baophu (MA_SPQD, TEN_SPQD, Username, Thu_tu_sap_xep) VALUES (@MA_SPQD, @TEN_SPQD, @Username, @Thu_tu_sap_xep)');
      }
    }

    await transaction.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
