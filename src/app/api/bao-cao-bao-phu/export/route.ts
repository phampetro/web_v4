import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/db';
import sql from 'mssql';
import { getAuthUser } from '@/lib/auth-guard';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

// Cấu hình cho từng loại báo cáo
const REPORT_CONFIGS: any = {
  khach_hang: {
    template: 'template_bao_cao_bao_phu_khach_hang.xlsx',
    table: 'ReportVBA_BP_KH',
    staticHeaders: ['Tên Miền', 'Tên Vùng', 'Khu Vực', 'NVBH', 'Mã KH', 'Tên KH', 'Địa Chỉ', 'Tần Suất', 'Thứ', 'Trưng Bày', 'Sku Đang bán'],
    sqlColumns: 'Tên_Miền, Tên_Vùng, Khu_Vực, Mã_Tên_NV, Mã_KH, Tên_KH, Địa_Chỉ, Tần_Suất, Thứ, Trưng_Bày, Sku_Đang_bán',
    pivotField: 'TONG_SL',
    pivotForField: 'TEN_SPQD',
    startDataCol: 12,
    numericCols: ['Sku_Đang_bán'],
    mergeRange: 10
  },
  tuyen: {
    template: 'template_bao_cao_bao_phu_tuyen.xlsx',
    table: 'ReportVBA_BP_TUYEN_NV_NPP',
    staticHeaders: ['Tên Miền', 'Tên Vùng', 'Khu Vực', 'NVBH', 'Thứ', 'Số KH Trên Tuyến', 'Đang Bán', 'Mất Bao Phủ', 'Số KH Trưng Bày'],
    sqlColumns: 'Tên_Miền, Tên_Vùng, Khu_vực, Mã_Tên_NV, Thứ, Số_KH_Trên_Tuyến, Đang_Bán, Mất_Bao_Phủ, Số_KH_Trưng_Bày',
    pivotField: 'SL_KH_BP',
    pivotForField: 'TEN_SPQD',
    startDataCol: 10,
    numericCols: ['Số_KH_Trên_Tuyến', 'Đang_Bán', 'Mất_Bao_Phủ', 'Số_KH_Trưng_Bày'],
    mergeRange: 5,
    extraWhere: 'AND Thứ is not null'
  },
  khu_vuc: {
    template: 'template_bao_cao_bao_phu_khu_vuc.xlsx',
    table: 'ReportVBA_BP_KHUVUC',
    staticHeaders: ['Tên Miền', 'Tên Vùng', 'Khu Vực', 'Tổng Số KH', 'Trưng Bày', 'Đang Bán', 'Mất Bao Phủ'],
    sqlColumns: 'Tên_Miền, Tên_Vùng, Khu_vực, Tổng_Số_KH, Số_KH_Trưng_bày, Đang_bán, Mất_bao_phủ',
    pivotField: 'Số_KH_BP',
    pivotForField: 'Tên_SP',
    startDataCol: 8,
    numericCols: ['Tổng_Số_KH', 'Số_KH_Trưng_bày', 'Đang_bán', 'Mất_bao_phủ'],
    mergeRange: 3,
    skipStaff: true,
    skipAreaTotal: true
  }
};

export async function POST(req: NextRequest) {
  try {
    const authResult = getAuthUser(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const { products, areas, reportType, ngayUpdate } = body;

    const config = REPORT_CONFIGS[reportType || 'khach_hang'];
    if (!config) return NextResponse.json({ error: 'Loại báo cáo không hợp lệ' }, { status: 400 });

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'Danh sách sản phẩm trống' }, { status: 400 });
    }

    const pool = await connectToDB();
    const productNames = products.map((p: any) => `[${p.TEN_SPQD.replace(/]/g, "]]")}]`).join(', ');
    
    const request = pool.request();
    let areaCondition = '';
    if (areas && areas.length > 0) {
      const areaParams = areas.map((a: string, i: number) => {
        const paramName = `area${i}`;
        request.input(paramName, sql.NVarChar, a);
        return `@${paramName}`;
      }).join(', ');
      areaCondition = `WHERE Khu_vực IN (${areaParams})`;
    }

    const query = `
      SELECT 
        ${config.sqlColumns},
        ${productNames}
      FROM ${config.table} 
      PIVOT (
        SUM(${config.pivotField}) 
        FOR ${config.pivotForField} IN (${productNames})
      ) AS pivot_table 
      ${areaCondition} ${config.extraWhere || ''}
      ORDER BY Tên_Miền, Tên_Vùng, Khu_vực
    `;



    const result = await request.query(query);
    const rows = result.recordset;

    const templatePath = path.join(process.cwd(), 'public', 'templates', config.template);
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Không tìm thấy file template tại ' + templatePath }, { status: 404 });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) return NextResponse.json({ error: 'Template không hợp lệ' }, { status: 500 });

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    worksheet.getCell('B3').value = timeStr;

    if (ngayUpdate) {
      const dTo = new Date(ngayUpdate);
      if (!isNaN(dTo.getTime())) {
        const dateToStr = `${dTo.getDate().toString().padStart(2, '0')}/${(dTo.getMonth() + 1).toString().padStart(2, '0')}/${dTo.getFullYear()}`;
        worksheet.getCell('D4').value = dateToStr;
        const dFrom = new Date(dTo);
        dFrom.setDate(dFrom.getDate() - 90);
        const dateFromStr = `${dFrom.getDate().toString().padStart(2, '0')}/${(dFrom.getMonth() + 1).toString().padStart(2, '0')}/${dFrom.getFullYear()}`;
        worksheet.getCell('B4').value = dateFromStr;
      }
    }

    const dynamicHeaders = products.map((p: any) => p.TEN_SPQD);
    const allHeaders = [...config.staticHeaders, ...dynamicHeaders];
    const headerRow = worksheet.getRow(6);
    allHeaders.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    });

    let currentRowIndex = 7;
    const startDataCol = config.startDataCol;

    const calculateTotals = (items: any[]) => {
      const totals: any = {};
      dynamicHeaders.forEach((h: string) => {
        totals[h] = items.reduce((sum: number, item: any) => sum + (item[h] || 0), 0);
      });
      config.numericCols.forEach((col: string) => {
        totals[col] = items.reduce((sum: number, item: any) => sum + (item[col] || 0), 0);
      });
      return totals;
    };

    const insertTotalRow = (label: string, totals: any, type: 'STAFF' | 'AREA' | 'REGION' | 'ZONE' | 'GRAND') => {
      const row = worksheet.getRow(currentRowIndex++);
      row.getCell(1).value = label;
      worksheet.mergeCells(row.number, 1, row.number, config.mergeRange);
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };

      config.numericCols.forEach((col: string, idx: number) => {
        const colIndex = config.mergeRange + 1 + idx;
        const cell = row.getCell(colIndex);
        cell.value = totals[col];
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false };
      });

      dynamicHeaders.forEach((h: string, i: number) => {
        const cell = row.getCell(startDataCol + i);
        cell.value = totals[h];
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false };
      });

      const colors = { GRAND: 'FFFFFF00', REGION: 'FFCCFFCC', ZONE: 'FFE6F7FF', AREA: 'FFFFF2CC', STAFF: 'FFF2F2F2' };
      const bgColor = colors[type];
      for (let i = 1; i <= allHeaders.length; i++) {
        const cell = row.getCell(i);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
    };

    const miềnGroups = Object.groupBy(rows, (r: any) => r.Tên_Miền);
    for (const [miền, miềnRows] of Object.entries(miềnGroups)) {
      const vùngGroups = Object.groupBy(miềnRows as any[], (r: any) => r.Tên_Vùng);
      for (const [vùng, vùngRows] of Object.entries(vùngGroups)) {
        const khuVucGroups = Object.groupBy(vùngRows as any[], (r: any) => r.Khu_vực || r.Khu_Vực);
        for (const [khuVuc, khuVucRows] of Object.entries(khuVucGroups)) {
          if (config.skipStaff) {
            (khuVucRows as any[]).forEach((item: any) => {
              const row = worksheet.getRow(currentRowIndex++);
              const sqlColsArray = config.sqlColumns.split(',').map((s: string) => s.trim());
              const rowValues = config.staticHeaders.map((h: string, idx: number) => item[sqlColsArray[idx]]);
              row.values = [...rowValues, ...dynamicHeaders.map((h: string) => item[h] || 0)];
              for (let i = 1; i <= allHeaders.length; i++) {
                const cell = row.getCell(i);
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                if (i > config.staticHeaders.length) cell.alignment = { vertical: 'middle', horizontal: 'right' };
              }
            });
          } else {
            const nvbhGroups = Object.groupBy(khuVucRows as any[], (r: any) => r.Mã_Tên_NV);
            for (const [nvbh, nvbhRows] of Object.entries(nvbhGroups)) {
              (nvbhRows as any[]).forEach((item: any) => {
                const row = worksheet.getRow(currentRowIndex++);
                const sqlColsArray = config.sqlColumns.split(',').map((s: string) => s.trim());
                const rowValues = config.staticHeaders.map((h: string, idx: number) => item[sqlColsArray[idx]]);
                row.values = [...rowValues, ...dynamicHeaders.map((h: string) => item[h] || 0)];
                for (let i = 1; i <= allHeaders.length; i++) {
                  const cell = row.getCell(i);
                  cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                  if (i > config.staticHeaders.length) cell.alignment = { vertical: 'middle', horizontal: 'right' };
                }
              });
              insertTotalRow(`TỔNG NV: ${nvbh}`, calculateTotals(nvbhRows as any[]), 'STAFF');
            }
          }
          if (!config.skipAreaTotal) {
            insertTotalRow(`TỔNG KHU VỰC: ${khuVuc}`, calculateTotals(khuVucRows as any[]), 'AREA');
          }
        }
        insertTotalRow(`TỔNG VÙNG: ${vùng}`, calculateTotals(vùngRows as any[]), 'ZONE');
      }
      insertTotalRow(`TỔNG MIỀN: ${miền}`, calculateTotals(miềnRows as any[]), 'REGION');
    }

    insertTotalRow('TỔNG CỘNG TẤT CẢ', calculateTotals(rows), 'GRAND');

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=bao_cao_bao_phu.xlsx',
      },
    });

  } catch (error: any) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
