import React, { useEffect, useState, useMemo } from 'react';
import { Spin, Tag, Select, Button, Modal, message, Checkbox, Typography, Tooltip } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import { DownloadOutlined, PauseCircleOutlined, CameraOutlined, SendOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getCookie } from '../../../../utils/cookie';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useCachedData } from '../../../../hooks/useCachedData';
import { THU_OPTIONS, THU_LIST, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../../../constants';

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

const columns: ColumnsType<KHRecord> = [
  { title: 'STT', key: 'stt', width: 45, align: 'center', render: (_v, _r, index) => index + 1 },
  { title: 'NVBH', dataIndex: 'Mã_Tên_NVBH', key: 'Mã_Tên_NVBH', width: 210, align: 'left' },
  {
    title: 'Khách hàng',
    key: 'khach_hang',
    width: 210,
    align: 'left',
    render: (_, r) => (
      <Tooltip title={`${r.Mã_KH} - ${r.Tên_KH}`} mouseEnterDelay={0.5}>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <Text strong style={{ color: '#1677ff', fontSize: 13, marginRight: 4 }}>{r.Mã_KH}</Text>
          <Text style={{ fontSize: 13 }}> - {r.Tên_KH}</Text>
        </div>
      </Tooltip>
    )
  },
  { title: 'Địa chỉ', dataIndex: 'Địa_Chỉ', key: 'Địa_Chỉ', width: 220, align: 'left' },
  { title: 'Thứ', dataIndex: 'Thứ', key: 'Thứ', width: 40, align: 'center' },
  { title: 'Tần suất', dataIndex: 'Tần_Suất', key: 'Tần_Suất', width: 75, align: 'center', render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '-' },
  { title: 'Trưng bày', dataIndex: 'Trưng_Bày', key: 'Trưng_Bày', width: 100, align: 'center' },
  {
    title: 'Ngày ĐH Cuối', dataIndex: 'Ngày_ĐH_Cuối', key: 'Ngày_ĐH_Cuối', width: 100, align: 'center',
    render: (v: string | null) => {
      if (!v) return '-';
      const d = new Date(v);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    },
  },
  { title: 'Khu vực', dataIndex: 'Khu_Vực', key: 'Khu_Vực', width: 80, align: 'center' },
];

export default function KPSDSModule({ ngayUpdate, setNgayUpdate }: { ngayUpdate: string, setNgayUpdate?: (d: string) => void }) {
  const { data, loading, loadingText, reloadData, forceReload } = useCachedData<KHRecord>({
    storeName: STORE_NAME,
    cacheKey: CACHE_KEY,
    apiPath: '/api/khach-hang/kpsds',
    ngayUpdate,
    setNgayUpdate
  });

  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
  const [selectedNVBH, setSelectedNVBH] = useState<string | undefined>();
  const [selectedKH, setSelectedKH] = useState<string | undefined>();
  const dayIdx = new Date().getDay(); // 0=CN, 1=T2...
  const todayThu = THU_LIST[(dayIdx + 6) % 7]; // Chuyển đổi để khớp với mảng T2 -> CN
  const [selectedThu, setSelectedThu] = useState<string[]>([todayThu]);
  const [selectedTanSuat, setSelectedTanSuat] = useState<string[]>([]);
  const [showAllKH, setShowAllKH] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportingTN, setExportingTN] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [tamNgungModalOpen, setTamNgungModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [cachedKhuVuc, setCachedKhuVuc] = useState<string[]>([]);
  const [cachedNVBH, setCachedNVBH] = useState<{ MA_TEN_NVBH: string, TEN_KHUVUC: string }[]>([]);

  // Đọc danh mục từ Cache IndexedDB
  useEffect(() => {
    const loadCache = async () => {
      try {
        const { getCacheMeta } = await import('@/utils/indexedDB');
        const kv = await getCacheMeta('common_khuvuc');
        const nv = await getCacheMeta('common_nvbh');
        if (kv) setCachedKhuVuc(JSON.parse(kv));
        if (nv) setCachedNVBH(JSON.parse(nv));
      } catch (e) {
        console.error('Load filter cache error:', e);
      }
    };
    loadCache();
  }, []);



  const khuVucOptions = useMemo(() => {
    const list = cachedKhuVuc.length > 0 ? cachedKhuVuc : [...new Set(data.map((r) => r.Khu_Vực).filter(Boolean))].sort();
    return list.map((v) => ({ label: v, value: v }));
  }, [data, cachedKhuVuc]);

  const nvbhOptions = useMemo(() => {
    // Nếu có cache từ API dùng chung, ưu tiên sử dụng để đảm bảo quan hệ cha-con
    if (cachedNVBH.length > 0) {
      let filtered = cachedNVBH;
      if (selectedKhuVuc) {
        filtered = cachedNVBH.filter(n => n.TEN_KHUVUC === selectedKhuVuc);
      }
      return filtered.map(n => ({ label: n.MA_TEN_NVBH, value: n.MA_TEN_NVBH }));
    }

    // Fallback: Nếu cache trống, lấy từ data hiện tại
    let list: string[] = [];
    if (selectedKhuVuc) {
      list = [...new Set(data.filter(r => r.Khu_Vực === selectedKhuVuc).map(r => r.Mã_Tên_NVBH).filter(Boolean))].sort();
    } else {
      list = [...new Set(data.map(r => r.Mã_Tên_NVBH).filter(Boolean))].sort();
    }
    return list.map((v) => ({ label: v, value: v }));
  }, [data, selectedKhuVuc, cachedNVBH]);

  const tanSuatOptions = useMemo(() => {
    let filtered = data;
    if (selectedKhuVuc) filtered = filtered.filter((r) => r.Khu_Vực === selectedKhuVuc);
    if (selectedNVBH) filtered = filtered.filter((r) => r.Mã_Tên_NVBH === selectedNVBH);
    const unique = [...new Set(filtered.map((r) => r.Tần_Suất).filter(Boolean))].sort();
    return unique.map((v) => ({ label: v, value: v }));
  }, [data, selectedKhuVuc, selectedNVBH]);

  const khOptions = useMemo(() => {
    let filtered = data;
    if (selectedKhuVuc) filtered = filtered.filter((r) => r.Khu_Vực === selectedKhuVuc);
    if (selectedNVBH) filtered = filtered.filter((r) => r.Mã_Tên_NVBH === selectedNVBH);
    if (!showAllKH) filtered = filtered.filter((r) => !r.Ngày_ĐH_Cuối);

    const uniqueMap = new Map();
    filtered.forEach(r => {
      if (!uniqueMap.has(r.Mã_KH)) {
        uniqueMap.set(r.Mã_KH, { label: `${r.Mã_KH} - ${r.Tên_KH}`, value: r.Mã_KH });
      }
    });
    return Array.from(uniqueMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [data, selectedKhuVuc, selectedNVBH, showAllKH]);

  const filteredData = useMemo(() => {
    return data.filter((r) => {
      if (selectedKhuVuc && r.Khu_Vực !== selectedKhuVuc) return false;
      if (selectedNVBH && r.Mã_Tên_NVBH !== selectedNVBH) return false;
      if (selectedKH && r.Mã_KH !== selectedKH) return false;
      if (selectedThu.length > 0 && !selectedThu.some((t) => r.Thứ.includes(t))) return false;
      if (selectedTanSuat.length > 0 && !selectedTanSuat.includes(r.Tần_Suất)) return false;
      if (!showAllKH && r.Ngày_ĐH_Cuối) return false;
      return true;
    });
  }, [data, selectedKhuVuc, selectedNVBH, selectedThu, selectedTanSuat, showAllKH]);

  const totalInScope = useMemo(() => {
    if (showAllKH) return data.length;
    return data.filter((r) => !r.Ngày_ĐH_Cuối).length;
  }, [data, showAllKH]);

  const exportExcel = async (rows: KHRecord[], prefix = 'KH_KPSDS') => {
    prefix === 'Tam_ngung' ? setExportingTN(true) : setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(prefix === 'Tam_ngung' ? 'Tạm ngưng' : 'Danh sách KH');
      const reportName = prefix === 'Tam_ngung' ? 'DANH SÁCH ĐĂNG KÝ TẠM NGƯNG KHÁCH HÀNG' : 'DANH SÁCH KHÁCH HÀNG KHÔNG PHÁT SINH DOANH SỐ TRONG 90 NGÀY';
      const filterKhuVuc = selectedKhuVuc || 'Tất cả';
      const filterNVBH = selectedNVBH || 'Tất cả';
      const filterThu = selectedThu.length > 0 ? selectedThu.join(', ') : 'Tất cả';
      const filterTanSuat = selectedTanSuat.length > 0 ? selectedTanSuat.join(', ') : 'Tất cả';
      const ngayRaw = getCookie('ngay_update') || ngayUpdate || '';
      const ngayFmt = ngayRaw ? new Date(ngayRaw).toLocaleDateString('vi-VN') : '';

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

      const headerRowsCount = prefix === 'Tam_ngung' ? 4 : 3;
      sheet.spliceRows(1, 0, ...Array(headerRowsCount).fill([]));

      sheet.mergeCells('A1:J1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = reportName;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center' };

      sheet.mergeCells('A2:J2');
      const filterCell = sheet.getCell('A2');
      filterCell.value = `Khu vực: ${filterKhuVuc} | NVBH: ${filterNVBH} | Thứ: ${filterThu} | Tần suất: ${filterTanSuat}`;
      filterCell.font = { italic: true };
      filterCell.alignment = { horizontal: 'center' };

      if (prefix === 'Tam_ngung') {
        sheet.mergeCells('A3:J3');
        const countCell = sheet.getCell('A3');
        countCell.value = `Số KH đã chọn: ${rows.length} | Ngày cập nhật: ${ngayFmt}`;
        countCell.alignment = { horizontal: 'center' };
      }

      const headerRow = sheet.getRow(headerRowsCount + 1);
      headerRow.font = { bold: true };
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

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
          ngay_dh_cuoi: r.Ngày_ĐH_Cuối ? new Date(r.Ngày_ĐH_Cuối).toLocaleDateString('vi-VN') : '',
        });
        row.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${prefix}_${new Date().getTime()}.xlsx`);
    } catch (e) {
      console.error(e);
      message.error('Lỗi xuất Excel');
    } finally {
      setExporting(false);
      setExportingTN(false);
    }
  };

  const captureTable = async () => {
    if (!selectedNVBH || selectedThu.length === 0) {
      Modal.warning({ title: 'Chưa đủ điều kiện', content: 'Vui lòng lọc 1 NVBH và ít nhất 1 Thứ.' });
      return;
    }
    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed; left:-9999px; background:#fff; padding:12px;';
      const ngayRaw = getCookie('ngay_update') || ngayUpdate || '';
      const ngayFormatted = ngayRaw ? new Date(ngayRaw).toLocaleDateString('vi-VN') : '';
      container.innerHTML = `
        <div style="font-weight:700; font-size:15px; margin-bottom:10px;">
          Khách hàng không phát sinh doanh số:<br/>
          <span style="font-weight:400; font-size:13px;">${selectedNVBH} - Tuyến ${selectedThu.join(', ')} - Ngày cập nhật: ${ngayFormatted}</span>
        </div>
        <table style="border-collapse:collapse; width:100%; font-size:12px;">
          <thead>
            <tr>
              ${['STT', 'NVBH', 'Mã KH', 'Tên KH', 'Địa chỉ', 'Thứ', 'Tần suất', 'Trưng bày', 'Ngày ĐH', 'Khu vực'].map(h => `<th style="border:1px solid #d9d9d9; padding:6px; background:#fafafa;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredData.map((r, i) => `
              <tr>
                ${[i + 1, r.Mã_Tên_NVBH, r.Mã_KH, r.Tên_KH, r.Địa_Chỉ, r.Thứ, r.Tần_Suất, r.Trưng_Bày || '-', r.Ngày_ĐH_Cuối ? new Date(r.Ngày_ĐH_Cuối).toLocaleDateString('vi-VN') : '-', r.Khu_Vực].map(c => `<td style="border:1px solid #d9d9d9; padding:4px;">${c}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2 });
      document.body.removeChild(container);
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          message.success('Đã copy ảnh vào clipboard!');
        }
      });
    } catch (err) {
      message.error('Lỗi chụp ảnh');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'nowrap', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Khu vực</div>
          <Select placeholder="Tất cả" value={selectedKhuVuc} onChange={v => { setSelectedKhuVuc(v); setSelectedNVBH(undefined); setSelectedKH(undefined); }} allowClear showSearch options={khuVucOptions} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>NVBH</div>
          <Select placeholder="Tất cả" value={selectedNVBH} onChange={v => { setSelectedNVBH(v); setSelectedKH(undefined); }} allowClear showSearch options={nvbhOptions} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Mã - Tên KH</div>
          <Select placeholder="Tìm kiếm..." value={selectedKH} onChange={setSelectedKH} allowClear showSearch options={khOptions} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Thứ</div>
          <Select mode="multiple" placeholder="Tất cả" value={selectedThu} onChange={setSelectedThu} allowClear options={THU_OPTIONS} style={{ width: '100%' }} maxTagCount="responsive" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Tần suất</div>
          <Select mode="multiple" placeholder="Tất cả" value={selectedTanSuat} onChange={setSelectedTanSuat} allowClear options={tanSuatOptions} style={{ width: '100%' }} maxTagCount="responsive" />
        </div>
        <div style={{ flex: 1 }}></div>
        <Button icon={<ReloadOutlined />} onClick={forceReload} loading={loading}>Tải lại</Button>
      </div>

      <Spin spinning={loading} description={loadingText}>
        <CustomTable
          columns={columns}
          dataSource={filteredData}
          rowKey={(r) => r.Mã_KH}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          onRow={(record) => ({
            onClick: () => {
              const key = record.Mã_KH;
              const newKeys = [...selectedRowKeys];
              const idx = newKeys.indexOf(key);
              if (idx >= 0) newKeys.splice(idx, 1);
              else newKeys.push(key);
              setSelectedRowKeys(newKeys);
            },
            style: { cursor: 'pointer' }
          })}
          pagination={{
            pageSize,
            onChange: (_, size) => setPageSize(size),
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (total, range) => <span>{range[0]}-{range[1]} / {total} — Hiển thị: <b>{filteredData.length}</b> / {totalInScope} KH</span>
          }}
        />
      </Spin>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Button icon={<DownloadOutlined />} onClick={() => exportExcel(filteredData)} disabled={filteredData.length === 0} loading={exporting}>Xuất Excel</Button>
        <Button icon={<PauseCircleOutlined />} onClick={() => selectedRowKeys.length ? setTamNgungModalOpen(true) : message.warning('Hãy Tick chọn khách hàng cần tạm ngưng')} danger={selectedRowKeys.length > 0}>Tạm ngưng ({selectedRowKeys.length})</Button>
        <Button icon={<CameraOutlined />} onClick={captureTable} loading={capturing} disabled={filteredData.length === 0}>Chụp ảnh</Button>
      </div>

      <Modal
        title="Đăng ký Tạm ngưng"
        open={tamNgungModalOpen}
        onCancel={() => setTamNgungModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setTamNgungModalOpen(false)}>Hủy</Button>,
          <Button
            key="export"
            icon={<DownloadOutlined />}
            loading={exportingTN}
            onClick={() => {
              const selected = filteredData.filter(r => selectedRowKeys.includes(r.Mã_KH));
              exportExcel(selected, 'Tam_ngung');
            }}
          >
            Xuất Excel (Chọn)
          </Button>,
          <Button key="submit" type="primary" icon={<SendOutlined />} loading={submittingApproval} style={{ backgroundColor: '#722ed1' }} onClick={async () => {
            const selected = data.filter(r => selectedRowKeys.includes(r.Mã_KH));
            if (selected.length === 0) return;

            setSubmittingApproval(true);
            try {
              // 1. Kiểm tra trạng thái hiện tại từ Server
              const resCheck = await fetch('/api/khach-hang/tam-ngung/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maKHs: selectedRowKeys })
              });
              const pendingList = await resCheck.json();

              if (!Array.isArray(pendingList)) {
                message.error('Không thể kiểm tra trạng thái đơn cũ');
                setSubmittingApproval(false);
                return;
              }

              const summary = selected.map(r => {
                const existing = pendingList.find((p: any) => p.Ma_KH === r.Mã_KH);
                let status = 'Đăng ký mới';
                let color = 'green';
                let isPending = false;

                if (existing) {
                  if (existing.Trang_thai_duyet === 'Từ chối') {
                    status = 'Gửi lại (Bị từ chối trước đó)';
                    color = 'orange';
                  } else {
                    status = `Đã gửi yêu cầu (${existing.Trang_thai_duyet})`;
                    color = 'blue';
                    isPending = true;
                  }
                }
                return { mãKH: r.Mã_KH, tênKH: r.Tên_KH, status, color, isPending, original: r };
              });

              setSubmittingApproval(false);

              Modal.confirm({
                title: 'Xác nhận gửi đăng ký Tạm ngưng',
                width: 500,
                content: (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ marginBottom: 12 }}>Bạn đang gửi đăng ký cho <b>{summary.length}</b> khách hàng sau:</div>
                    <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 8 }}>
                      {summary.map(s => (
                        <div key={s.mãKH} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, borderBottom: '1px solid #fafafa', paddingBottom: 4 }}>
                          <span style={{ fontSize: 13 }}><b>{s.mãKH}</b> - {s.tênKH}</span>
                          <Tag color={s.color} variant="filled" style={{ fontSize: 11 }}>{s.status}</Tag>
                        </div>
                      ))}
                    </div>
                    {summary.some(s => s.isPending) && (
                      <div style={{ marginTop: 12, color: '#fa8c16', fontSize: 12, fontStyle: 'italic' }}>
                        * Lưu ý: Những khách hàng "Đã gửi yêu cầu" sẽ được hệ thống bỏ qua để tránh gửi trùng lặp.
                      </div>
                    )}
                  </div>
                ),
                okText: 'Xác nhận gửi ngay',
                cancelText: 'Hủy',
                onOk: async () => {
                  setSubmittingApproval(true);
                  try {
                    let username = '';
                    const userInfoStr = localStorage.getItem('user_info');
                    if (userInfoStr) {
                      const userInfo = JSON.parse(userInfoStr);
                      username = userInfo.username || '';
                    }

                    const rows = summary.filter(s => !s.isPending).map(s => ({
                      Khu_vuc: s.original.Khu_Vực,
                      Ma_ten_nvbh: s.original.Mã_Tên_NVBH,
                      Ma_KH: s.mãKH,
                      Ten_KH: s.tênKH,
                      DC: s.original.Địa_Chỉ,
                      Thu: s.original.Thứ,
                      Tan_suat: s.original.Tần_Suất
                    }));

                    if (rows.length === 0) {
                      message.warning('Không có khách hàng nào hợp lệ để gửi mới');
                      return;
                    }

                    const res = await fetch('/api/khach-hang/tam-ngung', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ rows, nguoi_dang_ky: username })
                    });
                    const json = await res.json();
                    if (json.success) {
                      message.success(`Đã gửi yêu cầu cho ${json.inserted + json.updated} khách hàng!`);
                      setSelectedRowKeys([]);
                      setTamNgungModalOpen(false);
                    } else message.error(json.error);
                  } catch { message.error('Lỗi kết nối khi gửi dữ liệu'); } finally { setSubmittingApproval(false); }
                }
              });
            } catch (e) {
              console.error('Check TN error:', e);
              message.error('Lỗi khi kiểm tra dữ liệu');
              setSubmittingApproval(false);
            }
          }}>Gửi Manager duyệt TN</Button>
        ]}
      >
        <p>Bạn đã chọn <b>{selectedRowKeys.length}</b> khách hàng để đăng ký tạm ngưng.</p>
      </Modal>
    </div>
  );
}
