import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const username = cookieStore.get('username')?.value || '';

    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const username = cookieStore.get('username')?.value || '';

    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { products } = body; // Array of { MA_SPQD, TEN_SPQD, Thu_tu_sap_xep }

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
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
