import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';

export async function POST(req: NextRequest) {
    try {
        const { maKHs } = await req.json();
        if (!maKHs || !Array.isArray(maKHs) || maKHs.length === 0) {
            return NextResponse.json([]);
        }

        const db = await connectToDB();
        const request = db.request();
        const placeholders = maKHs.map((ma: string, i: number) => {
            const p = `ma${i}`;
            request.input(p, sql.NVarChar(50), ma);
            return `@${p}`;
        });

        const result = await request.query(`
            SELECT Ma_KH, Trang_thai_duyet 
            FROM tbl_dangky_tamngung_kh 
            WHERE Ma_KH IN (${placeholders.join(',')})
        `);

        return NextResponse.json(result.recordset);
    } catch (e) {
        console.error('API Check Tam Ngung Error:', e);
        return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
    }
}
