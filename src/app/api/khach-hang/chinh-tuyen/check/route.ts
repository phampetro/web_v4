import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { connectToDB } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { maKHs } = await req.json();
        if (!maKHs || !Array.isArray(maKHs) || maKHs.length === 0) {
            return NextResponse.json([]);
        }

        const pool = await connectToDB();
        
        // Tạo query kiểm tra hàng loạt các mã KH đang có trạng thái chờ duyệt (Trang_thai = 0)
        // Lưu ý: Trang_thai = 0 là Chờ duyệt, 1 là Đã duyệt, 2 là Từ chối
        const result = await pool.request()
            .query(`
                SELECT Ma_KH, Trang_thai_duyet 
                FROM tbl_dangky_chinhtuyen 
                WHERE Ma_KH IN (${maKHs.map(id => `'${id}'`).join(',')})
                AND Trang_thai_duyet = N'Chờ duyệt'
            `);

        // Ánh xạ lại kết quả để khớp với logic frontend
        const pendingList = result.recordset.map(r => ({
            Ma_KH: r.Ma_KH,
            Trang_thai_duyet: r.Trang_thai_duyet
        }));

        return NextResponse.json(pendingList);
    } catch (error: any) {
        console.error('API Check Chinh Tuyen Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
