import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';

export async function GET() {
  try {
    const db = await connectToDB();
    const result = await db.query('Select top(1) [Ngày_Update] from view_ReportVBA_NgayUpdate');
    const ngayUpdate = result.recordset[0]?.['Ngày_Update'] ?? null;
    return NextResponse.json({ ngayUpdate });
  } catch (e) {
    return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
