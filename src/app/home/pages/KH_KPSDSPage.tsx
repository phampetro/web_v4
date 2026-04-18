import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Spin, Tag, Select, Button, Modal, message, Checkbox, Typography } from 'antd';
import CustomTable from '../../../components/CustomTable';
import { DownloadOutlined, PauseCircleOutlined, CameraOutlined, SendOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getCookie } from '../../../utils/cookie';
import { getStoreData, setStoreData, getCacheMeta, setCacheMeta } from '../../../utils/indexedDB';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
const { Text } = Typography;
interface KHRecord {
  Tên_Miền: string;
  Tên_Vùng: string;
  Khu_Vực: string;
  Mã_NPP: string;
  Tên_NPP: string;
  Mã_Tên_NVBH: string;
  Mã_KH: string;
  Tên_KH: string;
  Địa_Chỉ: string;
  Tần_Suất: string;
  Thứ: string;
  Ngày_ĐH_Cuối: string | null;
  Trưng_Bày: string | null;
}

const STORE_NAME = 'kh_kpsds';
const CACHE_KEY = 'kh_kpsds_ngay_update';

// Thứ cố định
const thuOptions = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((v) => ({ label: v, value: v }));

const PAGE_SIZE = 20;

const columns: ColumnsType<KHRecord> = [
  {
    title: 'STT', key: 'stt', width: 50, align: 'center',
    render: (_v, _r, index) => index + 1,
  },
  { title: 'NVBH', dataIndex: 'Mã_Tên_NVBH', key: 'Mã_Tên_NVBH', width: 230, align: 'left' },
  { title: 'Mã KH', dataIndex: 'Mã_KH', key: 'Mã_KH', width: 110, align: 'left' },
  { title: 'Tên KH', dataIndex: 'Tên_KH', key: 'Tên_KH', width: 120, ellipsis: { showTitle: true }, align: 'left' },
  {
    title: 'Địa chỉ', dataIndex: 'Địa_Chỉ', key: 'Địa_Chỉ', width: 220, align: 'left',
    render: (v) => (
      <Text style={{ fontSize: 12, color: '#434343' }} ellipsis={{ tooltip: v }}>
        {v}
      </Text>
    )
  },
  { title: 'Thứ', dataIndex: 'Thứ', key: 'Thứ', width: 45, align: 'center' },
  {
    title: 'Tần suất', dataIndex: 'Tần_Suất', key: 'Tần_Suất', width: 75, align: 'center',
    render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '-',
  },
  {
    title: 'Trưng bày', dataIndex: 'Trưng_Bày', key: 'Trưng_Bày', width: 100, align: 'center',
    render: (v: string | null) => (
      <Text style={{ fontSize: 12, color: '#434343' }} ellipsis={{ tooltip: v || '-' }}>
        {v || '-'}
      </Text>
    )
  },
  {
    title: 'Ngày ĐH Cuối', dataIndex: 'Ngày_ĐH_Cuối', key: 'Ngày_ĐH_Cuối', width: 100, align: 'center',
    render: (v: string | null) => {
      if (!v) return '-';
      const d = new Date(v);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    },
  },
  { title: 'Khu vực', dataIndex: 'Khu_Vực', key: 'Khu_Vực', width: 80, align: 'left' },
];

export default function KH_KPSDSPage({ ngayUpdate, setNgayUpdate }: { ngayUpdate: string, setNgayUpdate?: (d: string) => void }) {
  const [data, setData] = useState<KHRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
  const [selectedNVBH, setSelectedNVBH] = useState<string | undefined>();
  const [selectedKH, setSelectedKH] = useState<string | undefined>();
  // Thứ hiện tại: getDay() → 0=CN, 1=T2, 2=T3, ...
  const todayThu = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date().getDay()];
  const [selectedThu, setSelectedThu] = useState<string[]>([todayThu]);
  const [selectedTanSuat, setSelectedTanSuat] = useState<string[]>([]);
  const [showAllKH, setShowAllKH] = useState(false); // Trạng thái hiển thị Tất cả KH

  const [exporting, setExporting] = useState(false);
  const [exportingTN, setExportingTN] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [tamNgungModalOpen, setTamNgungModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pageSize, setPageSize] = useState(100);
  const [loadingText, setLoadingText] = useState("Đang tải dữ liệu...");
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, [ngayUpdate]);

  const loadData = async () => {
    setLoading(true);
    setLoadingText("Đang kiểm tra bộ nhớ đệm (Cache)...");
    try {
      // So sánh ngày cập nhật: nếu cache đã có và ngày khớp → dùng IndexedDB
      const cachedDate = await getCacheMeta(CACHE_KEY);
      if (cachedDate && ngayUpdate && cachedDate === ngayUpdate) {
        setLoadingText("Đang tải dữ liệu từ Cache...");
        const cached = await getStoreData<KHRecord>(STORE_NAME);
        if (cached.length > 0) {
          setData(cached);
          setLoading(false);
          return;
        }
      }
      // Ngày mới hơn hoặc chưa có cache → fetch từ DB
      setLoadingText("Đang tải dữ liệu từ máy chủ...");
      await fetchFromAPI();
    } catch {
      // IndexedDB lỗi → fallback fetch
      setLoadingText("Lỗi Cache, đang tải từ máy chủ...");
      await fetchFromAPI();
    }
  };

  const fetchFromAPI = async (newNgayUpdate?: string) => {
    setLoading(true);
    try {
      const quyenQL = getCookie('quyen_dl') || '';
      const res = await fetch(`/api/kh-kpsds?quyen_dl=${encodeURIComponent(quyenQL)}`);
      const json = await res.json();
      if (json.data) {
        setData(json.data);
        // Lưu IndexedDB cache + version
        await setStoreData(STORE_NAME, json.data);
        const dateToSave = newNgayUpdate || ngayUpdate;
        if (dateToSave) {
          await setCacheMeta(CACHE_KEY, dateToSave);
          if (setNgayUpdate) {
            setNgayUpdate(dateToSave);
            // Cập nhật cookie để sidebar và các trang khác thấy
            const { setCookie } = await import('../../../utils/cookie');
            setCookie('ngay_update', dateToSave, 7);
          }
        }
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReload = async () => {
    setLoading(true);
    try {
      // 1. Lấy ngày cập nhật mới nhất từ Server
      const res = await fetch('/api/ngay-update');
      const json = await res.json();
      const serverNgayUpdate = json.ngayUpdate;

      // 2. Lấy ngày cập nhật đang lưu trong Cache
      const cachedDate = await getCacheMeta(CACHE_KEY);

      // 3. So sánh
      if (serverNgayUpdate && cachedDate && serverNgayUpdate === cachedDate) {
        setLoading(false);
        Modal.confirm({
          title: 'Thông báo',
          content: 'Dữ liệu đang là mới nhất, bạn có muốn tải lại?',
          okText: 'Đồng ý',
          cancelText: 'Hủy',
          onOk: () => fetchFromAPI(serverNgayUpdate),
        });
      } else {
        // Nếu khác ngày hoặc chưa có cache -> Tải luôn
        await fetchFromAPI(serverNgayUpdate);
      }
    } catch (e) {
      // Lỗi thì cứ fetch đại
      await fetchFromAPI();
    }
  };

  // Options Khu vực từ data
  const khuVucOptions = useMemo(() => {
    const unique = [...new Set(data.map((r) => r.Khu_Vực).filter(Boolean))].sort();
    return unique.map((v) => ({ label: v, value: v }));
  }, [data]);

  // Options NVBH kế thừa từ Khu vực
  const nvbhOptions = useMemo(() => {
    const filtered = selectedKhuVuc ? data.filter((r) => r.Khu_Vực === selectedKhuVuc) : data;
    const unique = [...new Set(filtered.map((r) => r.Mã_Tên_NVBH).filter(Boolean))].sort();
    return unique.map((v) => ({ label: v, value: v }));
  }, [data, selectedKhuVuc]);

  // Options Tần suất kế thừa từ Khu vực + NVBH
  const tanSuatOptions = useMemo(() => {
    let filtered = data;
    if (selectedKhuVuc) filtered = filtered.filter((r) => r.Khu_Vực === selectedKhuVuc);
    if (selectedNVBH) filtered = filtered.filter((r) => r.Mã_Tên_NVBH === selectedNVBH);
    const unique = [...new Set(filtered.map((r) => r.Tần_Suất).filter(Boolean))].sort();
    return unique.map((v) => ({ label: v, value: v }));
  }, [data, selectedKhuVuc, selectedNVBH]);

  // Options Khách hàng kế thừa từ các bộ lọc (Khu vực, NVBH, ShowAll)
  const khOptions = useMemo(() => {
    let filtered = data;
    if (selectedKhuVuc) filtered = filtered.filter((r) => r.Khu_Vực === selectedKhuVuc);
    if (selectedNVBH) filtered = filtered.filter((r) => r.Mã_Tên_NVBH === selectedNVBH);

    // Nếu không tick "Tất cả KH", ẩn những khách hàng ĐÃ CÓ doanh số (Ngày ĐH Cuối khác rỗng)
    if (!showAllKH) {
      filtered = filtered.filter((r) => !r.Ngày_ĐH_Cuối);
    }

    // Đảm bảo unique theo Mã_KH
    const uniqueMap = new Map();
    filtered.forEach(r => {
      if (!uniqueMap.has(r.Mã_KH)) {
        uniqueMap.set(r.Mã_KH, { label: `${r.Mã_KH} - ${r.Tên_KH}`, value: r.Mã_KH });
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [data, selectedKhuVuc, selectedNVBH, showAllKH]);

  // Khi đổi Khu vực → reset NVBH + Tần suất nếu không còn hợp lệ
  const handleKhuVucChange = (value: string | undefined) => {
    setSelectedKhuVuc(value);
    if (value) {
      const validRecords = data.filter((r) => r.Khu_Vực === value);

      const validNVBH = validRecords.map((r) => r.Mã_Tên_NVBH);
      if (selectedNVBH && !validNVBH.includes(selectedNVBH)) {
        setSelectedNVBH(undefined);
      }

      const validKH = new Set(validRecords.map(r => r.Mã_KH));
      if (selectedKH && !validKH.has(selectedKH)) {
        setSelectedKH(undefined);
      }

      const validTanSuat = new Set(validRecords.map((r) => r.Tần_Suất));
      setSelectedTanSuat((prev) => prev.filter((v) => validTanSuat.has(v)));
    }
  };

  // Khi đổi NVBH → reset Tần suất nếu không còn hợp lệ
  const handleNVBHChange = (value: string | undefined) => {
    setSelectedNVBH(value);
    if (value) {
      let filtered = data;
      if (selectedKhuVuc) filtered = filtered.filter((r) => r.Khu_Vực === selectedKhuVuc);
      filtered = filtered.filter((r) => r.Mã_Tên_NVBH === value);

      const validKH = new Set(filtered.map(r => r.Mã_KH));
      if (selectedKH && !validKH.has(selectedKH)) {
        setSelectedKH(undefined);
      }

      const validTanSuat = new Set(filtered.map((r) => r.Tần_Suất));
      setSelectedTanSuat((prev) => prev.filter((v) => validTanSuat.has(v)));
    }
  };

  // Khi chọn Tất cả KH
  const handleShowAllChange = (e: any) => {
    const checked = e.target.checked;
    setShowAllKH(checked);
    if (checked) {
      // Clear tất cả bộ lọc
      setSelectedKhuVuc(undefined);
      setSelectedNVBH(undefined);
      setSelectedKH(undefined);
      setSelectedThu([]);
      setSelectedTanSuat([]);
    }
  };

  // Lọc + sắp xếp data
  const totalInScope = useMemo(() => {
    if (showAllKH) return data.length;
    return data.filter((r) => !r.Ngày_ĐH_Cuối).length;
  }, [data, showAllKH]);

  const filteredData = useMemo(() => {
    return data.filter((r) => {
      // Logic lọc theo bộ lọc hiện tại
      if (selectedKhuVuc && r.Khu_Vực !== selectedKhuVuc) return false;
      if (selectedNVBH && r.Mã_Tên_NVBH !== selectedNVBH) return false;
      if (selectedKH && r.Mã_KH !== selectedKH) return false;
      if (selectedThu.length > 0 && !selectedThu.some((t) => r.Thứ.includes(t))) return false;
      if (selectedTanSuat.length > 0 && !selectedTanSuat.includes(r.Tần_Suất)) return false;

      // Nếu không tick "Tất cả KH", thì mặc định ẩn những khách hàng ĐÃ CÓ doanh số (Ngày ĐH Cuối khác rỗng)
      if (!showAllKH && r.Ngày_ĐH_Cuối) return false;

      return true;
    });
  }, [data, selectedKhuVuc, selectedNVBH, selectedThu, selectedTanSuat, showAllKH]);

  // Xuất Excel
  const exportExcel = async (rows: KHRecord[], prefix = 'KH_KPSDS') => {
    prefix === 'Tam_ngung' ? setExportingTN(true) : setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(prefix === 'Tam_ngung' ? 'Tạm ngưng' : 'Danh sách KH');

      // Header info
      const reportName = prefix === 'Tam_ngung' ? 'DANH SÁCH ĐĂNG KÝ TẠM NGƯNG KHÁCH HÀNG' : 'DANH SÁCH KHÁCH HÀNG KHÔNG PHÁT SINH DOANH SỐ TRONG 90 NGÀY';
      const filterKhuVuc = selectedKhuVuc || 'Tất cả';
      const filterNVBH = selectedNVBH || 'Tất cả';
      const filterThu = selectedThu.length > 0 ? selectedThu.join(', ') : 'Tất cả';
      const filterTanSuat = selectedTanSuat.length > 0 ? selectedTanSuat.join(', ') : 'Tất cả';
      const ngayRaw = getCookie('ngay_update') || ngayUpdate || '';
      const ngayFmt = ngayRaw ? new Date(ngayRaw).toLocaleDateString('vi-VN') : '';

      // Tạo cột trước (ExcelJS tự động đưa header cột vào dòng 1)
      const columnsDef = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Khu vực', key: 'khu_vuc', width: 15 },
        { header: 'NVBH', key: 'nvbh', width: 30 },
        { header: 'Mã KH', key: 'ma_kh', width: 15 },
        { header: 'Tên KH', key: 'ten_kh', width: 35 },
        { header: 'Địa chỉ', key: 'dc', width: 50 },
        { header: 'Thứ', key: 'thu', width: 10 },
        { header: 'Tần suất', key: 'tan_suat', width: 15 },
        { header: 'Trưng bày', key: 'trung_bay', width: 15 },
        { header: 'Ngày ĐH Cuối', key: 'ngay_dh_cuoi', width: 15 },
      ];
      sheet.columns = columnsDef;

      // Chèn các dòng trống lên trên để đẩy header cột xuống
      const headerRowsCount = prefix === 'Tam_ngung' ? 4 : 3;
      sheet.spliceRows(1, 0, ...Array(headerRowsCount).fill([]));

      // Ghi Title vào các dòng trống
      sheet.mergeCells('A1:J1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = reportName;
      titleCell.font = { bold: true, size: 16, color: { argb: 'FF000000' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.mergeCells('A2:J2');
      const filterCell = sheet.getCell('A2');
      filterCell.value = `Khu vực: ${filterKhuVuc} | NVBH: ${filterNVBH} | Thứ: ${filterThu} | Tần suất: ${filterTanSuat}`;
      filterCell.font = { italic: true, size: 11, color: { argb: 'FF595959' } };
      filterCell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (prefix === 'Tam_ngung') {
        sheet.mergeCells('A3:J3');
        const countCell = sheet.getCell('A3');
        countCell.value = `Số KH đã chọn: ${rows.length} | Ngày cập nhật: ${ngayFmt}`;
        countCell.font = { italic: true, size: 11, color: { argb: 'FF595959' } };
        countCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Định dạng lại header cột
      const headerRowNumber = headerRowsCount + 1;
      const excelHeaderRow = sheet.getRow(headerRowNumber);
      excelHeaderRow.font = { bold: true };
      excelHeaderRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });

      // Thêm dữ liệu
      rows.forEach((r, idx) => {
        const row = sheet.addRow({
          stt: idx + 1,
          khu_vuc: r.Khu_Vực,
          nvbh: r.Mã_Tên_NVBH,
          ma_kh: r.Mã_KH,
          ten_kh: r.Tên_KH,
          dc: r.Địa_Chỉ,
          thu: r.Thứ,
          tan_suat: r.Tần_Suất,
          trung_bay: r.Trưng_Bày || '',
          ngay_dh_cuoi: r.Ngày_ĐH_Cuối ? `${String(new Date(r.Ngày_ĐH_Cuối).getDate()).padStart(2, '0')}/${String(new Date(r.Ngày_ĐH_Cuối).getMonth() + 1).padStart(2, '0')}/${new Date(r.Ngày_ĐH_Cuối).getFullYear()}` : '',
        });
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
          };
        });
      });

      // Tự động co giãn cột cho vừa dữ liệu
      if (sheet.columns) {
        sheet.columns.forEach((column) => {
          if (!column || !column.eachCell) return;
          let maxColumnLength = 0;
          column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
            // Bỏ qua 4 dòng tiêu đề gộp phía trên
            if (rowNumber <= 4) return;
            const cellValue = cell.value ? cell.value.toString() : '';
            maxColumnLength = Math.max(maxColumnLength, cellValue.length);
          });
          // Cấp thêm 2 ký tự làm padding, tối đa 100 để không bị quá rộng
          column.width = Math.min(Math.max(maxColumnLength + 2, 10), 100);
        });
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ts = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${prefix}_${ts}.xlsx`);
    } catch (e) {
      console.error(e);
      message.error('Lỗi xuất Excel');
    } finally {
      setExporting(false);
      setExportingTN(false);
    }
  };

  // Chụp ảnh bảng → copy vào clipboard
  const captureTable = async () => {
    if (!selectedNVBH || selectedThu.length === 0) {
      Modal.warning({
        title: 'Chưa đủ điều kiện chụp',
        content: 'Vui lòng lọc 1 NVBH và ít nhất 1 Thứ viếng thăm trước khi chụp ảnh bảng.',
      });
      return;
    }
    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      // Tạo bảng ẩn chứa TẤT CẢ dòng filter (không phân trang)
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.background = '#fff';
      container.style.padding = '12px';
      container.style.zIndex = '-1';

      // Dòng tiêu đề trên ảnh
      const header = document.createElement('div');
      header.style.cssText = 'margin-bottom:10px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:14px; line-height:1.8;';
      const ngayRaw = getCookie('ngay_update') || ngayUpdate || '';
      const ngayFormatted = ngayRaw ? new Date(ngayRaw).toLocaleDateString('vi-VN') : '';
      header.innerHTML = `
        <div style="font-weight:700; font-size:15px;">Khách hàng không phát sinh doanh số:</div>
        <div>${selectedNVBH} - Tuyến ${selectedThu.join(', ')} - Ngày cập nhật: ${ngayFormatted}</div>
      `;
      container.appendChild(header);

      // Tạo table HTML thuần
      const table = document.createElement('table');
      table.style.borderCollapse = 'collapse';
      table.style.fontSize = '13px';
      table.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      table.style.width = '100%';

      // Header
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      const headers = ['STT', 'NVBH', 'Mã KH', 'Tên KH', 'Địa chỉ', 'Thứ', 'Tần suất', 'Trưng bày', 'Ngày ĐH Cuối', 'Khu vực'];
      headers.forEach((h) => {
        const th = document.createElement('th');
        th.textContent = h;
        th.style.cssText = 'border:1px solid #d9d9d9; padding:6px 10px; background:#fafafa; font-weight:600; text-align:center; white-space:nowrap;';
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Body - TẤT CẢ dòng filter
      const tbody = document.createElement('tbody');
      filteredData.forEach((r, i) => {
        const tr = document.createElement('tr');
        tr.style.background = i % 2 === 0 ? '#fff' : '#fafafa';
        const fmtDate = (v: string | null) => {
          if (!v) return '-';
          const d = new Date(v);
          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        };
        const cells = [
          String(i + 1), r.Mã_Tên_NVBH, r.Mã_KH, r.Tên_KH, r.Địa_Chỉ,
          r.Thứ, r.Tần_Suất, r.Trưng_Bày || '-', fmtDate(r.Ngày_ĐH_Cuối), r.Khu_Vực,
        ];
        cells.forEach((c, ci) => {
          const td = document.createElement('td');
          td.textContent = c;
          td.style.cssText = 'border:1px solid #d9d9d9; padding:4px 10px; white-space:nowrap;';
          if (ci === 0 || ci === 5 || ci === 6 || ci === 7 || ci === 8) td.style.textAlign = 'center';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
      document.body.appendChild(container);

      // Chụp
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      document.body.removeChild(container);

      // Copy vào clipboard
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob }),
            ]);
            message.success('Đã chụp và copy vào clipboard! Dán bằng Ctrl+V');
          } catch {
            // Fallback: tải về
            const link = document.createElement('a');
            link.download = 'bang_kh_kpsds.png';
            link.href = canvas.toDataURL();
            link.click();
            message.info('Đã tải ảnh về máy');
          }
        }
      }, 'image/png');
    } catch (err) {
      message.error('Lỗi chụp ảnh bảng');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>


      {/* Filter bar */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 12,
        alignItems: 'center',
        padding: '0 0 12px 0',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Khu vực</div>
          <Select
            placeholder="Tất cả"
            value={selectedKhuVuc}
            onChange={handleKhuVucChange}
            allowClear
            showSearch
            optionFilterProp="label"
            options={khuVucOptions}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>NVBH</div>
          <Select
            placeholder="Tất cả"
            value={selectedNVBH}
            onChange={handleNVBHChange}
            allowClear
            showSearch
            optionFilterProp="label"
            options={nvbhOptions}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 2, minWidth: 240 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Mã - Tên KH</div>
          <Select
            placeholder="Tìm kiếm Mã hoặc Tên KH"
            value={selectedKH}
            onChange={setSelectedKH}
            allowClear
            showSearch
            optionFilterProp="label"
            options={khOptions}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Thứ</div>
          <Select
            mode="multiple"
            placeholder="Tất cả"
            value={selectedThu}
            onChange={setSelectedThu}
            allowClear
            options={thuOptions}
            style={{ width: '100%' }}
            maxTagCount="responsive"
          />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Tần suất</div>
          <Select
            mode="multiple"
            placeholder="Tất cả"
            value={selectedTanSuat}
            onChange={setSelectedTanSuat}
            allowClear
            options={tanSuatOptions}
            style={{ width: '100%' }}
            maxTagCount="responsive"
          />
        </div>
        <div style={{ width: 100, display: 'flex', alignItems: 'center', height: 32, marginTop: 22, paddingLeft: 8 }}>
          <Checkbox checked={showAllKH} onChange={handleShowAllChange}>
            Tất cả KH
          </Checkbox>
        </div>
      </div>

      <Spin spinning={loading} description={loadingText}>
        <CustomTable
          columns={columns}
          dataSource={filteredData}
          rowKey={(r) => r.Mã_KH}
          tableLayout="fixed"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          pagination={{ 
            pageSize, 
            onChange: (page, size) => setPageSize(size),
            showSizeChanger: true,
            pageSizeOptions: [100, 500, 1000],
            showTotal: (total, range) => (
              <span>
                {range[0]}-{range[1]} / {total} — Hiển thị: <b>{filteredData.length}</b> / {totalInScope} khách hàng
              </span>
            )
          }}
        />
      </Spin>

      {/* Action bar */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleReload}
          loading={loading}
        >
          Tải lại
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => {
            Modal.confirm({
              title: 'Xuất Excel',
              content: 'Bạn muốn xuất dữ liệu đã lọc trong bảng hiện tại?',
              okText: 'Xuất',
              cancelText: 'Hủy',
              onOk: () => exportExcel(filteredData, 'KH_KPSDS'),
            });
          }}
          disabled={filteredData.length === 0}
          loading={exporting}
        >
          Xuất Excel
        </Button>
        <Button
          icon={<PauseCircleOutlined />}
          onClick={() => {
            if (selectedRowKeys.length === 0) {
              Modal.warning({
                title: 'Chưa chọn khách hàng',
                content: 'Hãy tick chọn các khách hàng bạn muốn tạm ngưng để tải về.',
              });
              return;
            }
            setTamNgungModalOpen(true);
          }}
          loading={exportingTN}
          danger={selectedRowKeys.length > 0}
        >
          Tạm ngưng ({selectedRowKeys.length})
        </Button>
        <Button
          icon={<CameraOutlined />}
          onClick={captureTable}
          loading={capturing}
          disabled={filteredData.length === 0}
        >
          Chụp ảnh
        </Button>
      </div>

      {/* Modal Tạm ngưng */}
      <Modal
        title="Tạm ngưng"
        open={tamNgungModalOpen}
        onCancel={() => setTamNgungModalOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={submittingApproval}
              style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
              onClick={async () => {
                const selected = filteredData.filter((r) => selectedRowKeys.includes(r.Mã_KH));
                setSubmittingApproval(true);
                try {
                  const rows = selected.map((r) => ({
                    Khu_vuc: r.Khu_Vực,
                    Ma_ten_nvbh: r.Mã_Tên_NVBH,
                    Ma_KH: r.Mã_KH,
                    Ten_KH: r.Tên_KH,
                    DC: r.Địa_Chỉ,
                    Thu: r.Thứ,
                    Tan_suat: r.Tần_Suất,
                  }));
                  const username = getCookie('username') || '';
                  const res = await fetch('/api/dangky-tamngung', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rows, nguoi_dang_ky: username }),
                  });
                  const json = await res.json();
                  if (json.success) {
                    if (json.inserted > 0 || json.updated > 0) {
                      message.success(`Đã gửi thành công ${json.inserted + (json.updated || 0)} KH cho Manager xét duyệt!`);
                    }
                    setSelectedRowKeys([]);
                    setTamNgungModalOpen(false);

                    const hasIgnored = json.ignored && json.ignored.length > 0;
                    const hasResubmitted = json.resubmitted && json.resubmitted.length > 0;

                    if (hasIgnored || hasResubmitted) {
                      Modal.warning({
                        title: 'Thông tin đăng ký khách hàng trùng lặp',
                        width: 600,
                        content: (
                          <div style={{ maxHeight: 400, overflowY: 'auto', marginTop: 12 }}>
                            {hasResubmitted && (
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ color: '#1890ff', marginBottom: 8 }}>
                                  ✅ <b>{json.resubmitted.length}</b> khách hàng từng bị <Tag color="red">Từ chối</Tag> đã được gửi duyệt lại:
                                </div>
                                <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13 }}>
                                  {json.resubmitted.map((ex: any, i: number) => (
                                    <li key={i} style={{ marginBottom: 6 }}>
                                      <b>{ex.Ma_KH}</b> - {ex.Ten_KH}
                                      <Tag style={{ marginLeft: 8 }} color="orange">Chờ duyệt</Tag>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {hasIgnored && (
                              <div>
                                <div style={{ color: '#d48806', marginBottom: 8 }}>
                                  ⚠️ <b>{json.ignored.length}</b> khách hàng đã tồn tại và bị bỏ qua:
                                </div>
                                <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13 }}>
                                  {json.ignored.map((ex: any, i: number) => (
                                    <li key={i} style={{ marginBottom: 6 }}>
                                      <b style={{ color: '#1890ff' }}>{ex.Ma_KH}</b> - {ex.Ten_KH}
                                      <Tag style={{ marginLeft: 8 }} color={
                                        ex.Trang_thai_duyet === 'Chờ duyệt' ? 'orange' :
                                          ex.Trang_thai_duyet === 'Đã duyệt' ? 'green' : 'default'
                                      }>
                                        {ex.Trang_thai_duyet}
                                      </Tag>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ),
                      });
                    } else if (json.inserted === 0 && (!json.updated || json.updated === 0)) {
                      message.warning('Tất cả khách hàng bạn chọn đều đã được đăng ký trước đó!');
                    }
                  } else {
                    message.error(json.error || 'Có lỗi xảy ra');
                  }
                } catch {
                  message.error('Lỗi kết nối server');
                } finally {
                  setSubmittingApproval(false);
                }
              }}
            >
              Gửi Manager duyệt TN
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setTamNgungModalOpen(false)}>Hủy</Button>
              <Button
                type="primary"
                loading={exportingTN}
                onClick={() => {
                  const selected = filteredData.filter((r) => selectedRowKeys.includes(r.Mã_KH));
                  exportExcel(selected, 'Tam_ngung');
                  setTamNgungModalOpen(false);
                }}
              >
                Xuất Excel
              </Button>
            </div>
          </div>
        }
        centered
      >
        <p>Bạn đã chọn <b>{selectedRowKeys.length}</b> khách hàng tạm ngưng.</p>
        <p>Chọn hành động:</p>
        <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
          <li><b>Gửi Manager duyệt TN</b>: Gửi danh sách cho Manager xét duyệt</li>
          <li><b>Xuất Excel</b>: Tải về file Excel danh sách bạn có nhu cầu tạm ngưng</li>
        </ul>
      </Modal>
    </div>
  );
}
