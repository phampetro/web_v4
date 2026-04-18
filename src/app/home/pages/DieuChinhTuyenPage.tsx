import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Spin, Tag, Select, Button, Modal, message, Input, Typography } from 'antd';
import CustomTable from '../../../components/CustomTable';
import type { ColumnsType } from 'antd/es/table';
import { getCookie } from '../../../utils/cookie';
import { getStoreData, setStoreData, getCacheMeta, setCacheMeta } from '../../../utils/indexedDB';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DownloadOutlined, PauseCircleOutlined, SendOutlined, ReloadOutlined } from '@ant-design/icons';

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



export default function DieuChinhTuyenPage({ ngayUpdate, setNgayUpdate }: { ngayUpdate: string, setNgayUpdate?: (d: string) => void }) {
  const [data, setData] = useState<KHRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string>();
  const [selectedNVBH, setSelectedNVBH] = useState<string>();
  const [selectedKHs, setSelectedKHs] = useState<string[]>([]);
  const [selectedThu, setSelectedThu] = useState<string>();

  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [dieuChinhModalOpen, setDieuChinhModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pageSize, setPageSize] = useState(100);
  const [loadingText, setLoadingText] = useState("Đang tải dữ liệu...");
  const [modifiedRows, setModifiedRows] = useState<Record<string, Partial<KHRecord>>>({});

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, [ngayUpdate]);

  const loadData = async () => {
    setLoading(true);
    setLoadingText("Đang kiểm tra bộ nhớ đệm (Cache)...");
    try {
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
      setLoadingText("Đang tải dữ liệu từ máy chủ...");
      await fetchFromAPI();
    } catch {
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
            // Cập nhật cookie
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
    setLoadingText("Đang kiểm tra phiên bản dữ liệu...");
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
          onOk: () => {
            setLoadingText("Đang tải lại toàn bộ dữ liệu...");
            fetchFromAPI(serverNgayUpdate);
          },
        });
      } else {
        setLoadingText("Có phiên bản mới, đang tải dữ liệu...");
        await fetchFromAPI(serverNgayUpdate);
      }
    } catch (e) {
      setLoadingText("Đang tải lại dữ liệu...");
      await fetchFromAPI();
    }
  };

  // Options Khu vực
  const khuVucOptions = useMemo(() => {
    const unique = [...new Set(data.map((r) => r.Khu_Vực).filter(Boolean))].sort();
    return unique.map((v) => ({ label: v, value: v }));
  }, [data]);

  // Options NVBH dựa trên Khu vực
  const nvbhOptions = useMemo(() => {
    const filtered = data.filter((r) => r.Khu_Vực === selectedKhuVuc);
    const unique = [...new Set(filtered.map((r) => r.Mã_Tên_NVBH).filter(Boolean))].sort();
    return unique.map((v) => ({ label: v, value: v }));
  }, [data, selectedKhuVuc]);

  // Options Tìm KH (Mã - Tên) dựa trên Khu vực + NVBH
  const khOptions = useMemo(() => {
    const filtered = data.filter((r) => r.Khu_Vực === selectedKhuVuc && r.Mã_Tên_NVBH === selectedNVBH);
    const uniqueKHs = Array.from(new Map(filtered.map(r => [r.Mã_KH, r])).values()).sort((a, b) => a.Mã_KH.localeCompare(b.Mã_KH));
    return uniqueKHs.map((r) => ({ label: `${r.Mã_KH} - ${r.Tên_KH}`, value: r.Mã_KH }));
  }, [data, selectedKhuVuc, selectedNVBH]);

  // Options Thứ dựa trên các bộ lọc trên
  const thuOptionsFiltered = useMemo(() => {
    let filtered = data.filter((r) => r.Khu_Vực === selectedKhuVuc && r.Mã_Tên_NVBH === selectedNVBH);
    if (selectedKHs.length > 0) {
      filtered = filtered.filter((r) => selectedKHs.includes(r.Mã_KH));
    }

    const allThus: string[] = [];
    filtered.forEach(r => {
      if (r.Thứ) {
        r.Thứ.split(/[,/ ]+/).forEach(t => {
          if (t.trim()) allThus.push(t.trim());
        });
      }
    });
    const unique = Array.from(new Set(allThus)).sort();
    return unique.map((v) => ({ label: v, value: v }));
  }, [data, selectedKhuVuc, selectedNVBH, selectedKHs]);

  // Effect xử lý mặc định giá trị đầu tiên khi cấp cha thay đổi
  useEffect(() => {
    if (data.length === 0) return;

    // 1. Khu vực
    if (!selectedKhuVuc && khuVucOptions.length > 0) {
      setSelectedKhuVuc(khuVucOptions[0].value);
      return;
    }

    // 2. NVBH
    const isNVBHValid = nvbhOptions.some(opt => opt.value === selectedNVBH);
    if (!isNVBHValid && nvbhOptions.length > 0) {
      setSelectedNVBH(nvbhOptions[0].value);
      return;
    }

    // 3. Tìm KH - Lọc lại nếu giá trị cũ không còn hợp lệ
    const validKHs = selectedKHs.filter(val => khOptions.some(opt => opt.value === val));
    if (validKHs.length !== selectedKHs.length) {
      setSelectedKHs(validKHs);
      return;
    }

    // 5. Thứ
    const isThuValid = thuOptionsFiltered.some(opt => opt.value === selectedThu);
    if (!isThuValid && thuOptionsFiltered.length > 0) {
      const today = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date().getDay()];
      const hasToday = thuOptionsFiltered.some(opt => opt.value === today);
      setSelectedThu(hasToday ? today : thuOptionsFiltered[0].value);
    }
  }, [data, selectedKhuVuc, selectedNVBH, selectedKHs, khuVucOptions, nvbhOptions, khOptions, thuOptionsFiltered]);

  // Hàm cập nhật dữ liệu dòng và tự động tick chọn
  const handleUpdateRow = (maKH: string, field: keyof KHRecord, value: any) => {
    const original = data.find(r => r.Mã_KH === maKH);
    if (!original) return;

    setModifiedRows((prev) => {
      const newMods = { ...prev[maKH], [field]: value };

      // Kiểm tra thực tế có khác biệt so với dữ liệu gốc không
      const isNVBHChanged = (newMods.Mã_Tên_NVBH ?? original.Mã_Tên_NVBH) !== original.Mã_Tên_NVBH;
      const isThuChanged = (newMods.Thứ ?? original.Thứ) !== original.Thứ;
      const isTanSuatChanged = (newMods.Tần_Suất ?? original.Tần_Suất) !== original.Tần_Suất;

      if (!isNVBHChanged && !isThuChanged && !isTanSuatChanged) {
        // Trùng khít dữ liệu gốc -> Xoá trạng thái chỉnh sửa và bỏ tick
        const next = { ...prev };
        delete next[maKH];
        setSelectedRowKeys(keys => keys.filter(k => k !== maKH));
        return next;
      }

      // Có khác biệt -> Lưu trạng thái chỉnh sửa và tự động tick
      setSelectedRowKeys(keys => keys.includes(maKH) ? keys : [...keys, maKH]);
      return { ...prev, [maKH]: newMods };
    });
  };

  const columns: ColumnsType<KHRecord> = [
    {
      title: 'STT', key: 'stt', width: 50, align: 'center',
      render: (_v, _r, index) => index + 1,
    },
    {
      title: 'NVBH', key: 'Mã_Tên_NVBH', width: 240, align: 'left',
      render: (_, r) => {
        const value = modifiedRows[r.Mã_KH]?.Mã_Tên_NVBH ?? r.Mã_Tên_NVBH;
        return (
          <Select
            value={value}
            style={{ width: '100%' }}
            options={nvbhOptions}
            onChange={(val) => handleUpdateRow(r.Mã_KH, 'Mã_Tên_NVBH', val)}
            showSearch
            optionFilterProp="label"
            size="small"
          />
        );
      }
    },
    { title: 'Mã KH', dataIndex: 'Mã_KH', key: 'Mã_KH', width: 100, align: 'left' },
    { title: 'Tên KH', dataIndex: 'Tên_KH', key: 'Tên_KH', width: 120, ellipsis: { showTitle: true }, align: 'left' },
    {
      title: 'Địa chỉ', dataIndex: 'Địa_Chỉ', key: 'Địa_Chỉ', width: 220, align: 'left',
      render: (v) => (
        <Text style={{ fontSize: 12, color: '#434343' }} ellipsis={{ tooltip: v }}>
          {v}
        </Text>
      )
    },
    {
      title: 'Thứ', key: 'Thứ', width: 180,
      render: (_, r) => {
        const v = modifiedRows[r.Mã_KH]?.Thứ ?? r.Thứ;
        const valArray = v ? v.split(/[,/ ]+/).filter(Boolean) : [];
        return (
          <Select
            mode="multiple"
            value={valArray}
            style={{ width: '100%' }}
            options={thuOptions}
            onChange={(vals) => {
              if (vals.length === 0) {
                message.warning('Lịch viếng thăm không được để trống');
                return;
              }
              if (vals.length > 2) {
                message.warning('Chỉ được chọn tối đa 2 thứ');
                return;
              }

              // Cập nhật Thứ
              handleUpdateRow(r.Mã_KH, 'Thứ', vals.join(', '));

              // Logic tự động cập nhật Tần suất
              if (vals.length === 2) {
                handleUpdateRow(r.Mã_KH, 'Tần_Suất', 'F8');
              } else if (vals.length === 1) {
                handleUpdateRow(r.Mã_KH, 'Tần_Suất', 'F4');
              }
            }}
            maxTagCount="responsive"
            size="small"
          />
        );
      }
    },
    {
      title: 'Tần suất', key: 'Tần_Suất', width: 130, align: 'center',
      render: (_, r) => {
        const currentThứ = modifiedRows[r.Mã_KH]?.Thứ ?? r.Thứ;
        const thuCount = currentThứ ? currentThứ.split(/[,/ ]+/).filter(Boolean).length : 0;
        const value = modifiedRows[r.Mã_KH]?.Tần_Suất ?? r.Tần_Suất;

        // Nếu chọn 2 thứ, ép cứng F8
        if (thuCount === 2) {
          return <Tag color="orange">F8</Tag>;
        }

        return (
          <Select
            value={value}
            style={{ width: '100%' }}
            options={[
              { label: 'F4', value: 'F4' },
              { label: 'F2 Chẵn', value: 'F2 Chẵn' },
              { label: 'F2 Lẻ', value: 'F2 Lẻ' },
            ]}
            onChange={(val) => handleUpdateRow(r.Mã_KH, 'Tần_Suất', val)}
            size="small"
          />
        );
      },
    },
    { title: 'Khu vực', dataIndex: 'Khu_Vực', key: 'Khu_Vực', width: 80, align: 'left' },
  ];



  // Xuất Excel
  const exportExcel = async (rows: KHRecord[], prefix = 'Dieu_chinh_tuyen') => {
    setLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Danh sách KH');

      // Header info
      const reportName = 'DANH SÁCH KHÁCH HÀNG ĐIỀU CHỈNH TUYẾN';
      const filterKhuVuc = selectedKhuVuc || 'Tất cả';
      const filterNVBH = selectedNVBH || 'Tất cả';
      const filterThu = selectedThu || 'Tất cả';
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
      sheet.spliceRows(1, 0, ...Array(3).fill([]));

      sheet.mergeCells('A1:J1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = reportName;
      titleCell.font = { bold: true, size: 16, color: { argb: 'FF000000' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.mergeCells('A2:J2');
      const filterCell = sheet.getCell('A2');
      filterCell.value = `Khu vực: ${filterKhuVuc} | NVBH: ${filterNVBH} | Thứ: ${filterThu} | Ngày cập nhật: ${ngayFmt}`;
      filterCell.font = { italic: true, size: 11, color: { argb: 'FF595959' } };
      filterCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const headerRowNumber = 4;
      const excelHeaderRow = sheet.getRow(headerRowNumber);
      excelHeaderRow.font = { bold: true };
      excelHeaderRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
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
          ngay_dh_cuoi: r.Ngày_ĐH_Cuối ? `${String(new Date(r.Ngày_ĐH_Cuối).getDate()).padStart(2, '0')}/${String(new Date(r.Ngày_ĐH_Cuối).getMonth() + 1).padStart(2, '0')}/${new Date(r.Ngày_ĐH_Cuối).getFullYear()}` : '',
        });
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
          };
        });
      });

      if (sheet.columns) {
        sheet.columns.forEach((column) => {
          if (!column || !column.eachCell) return;
          let maxColumnLength = 0;
          column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
            if (rowNumber <= 4) return;
            const cellValue = cell.value ? cell.value.toString() : '';
            maxColumnLength = Math.max(maxColumnLength, cellValue.length);
          });
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
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter((r) => {
      // Logic lọc theo bộ lọc hiện tại
      if (r.Khu_Vực !== selectedKhuVuc) return false;
      if (r.Mã_Tên_NVBH !== selectedNVBH) return false;
      if (selectedKHs.length > 0 && !selectedKHs.includes(r.Mã_KH)) return false;
      if (selectedThu && !r.Thứ.includes(selectedThu)) return false;

      return true;
    }).sort((a, b) =>
      a.Khu_Vực.localeCompare(b.Khu_Vực)
      || a.Mã_Tên_NVBH.localeCompare(b.Mã_Tên_NVBH)
      || a.Mã_KH.localeCompare(b.Mã_KH)
      || (a.Tần_Suất || '').localeCompare(b.Tần_Suất || '')
      || a.Thứ.localeCompare(b.Thứ)
    );
  }, [data, selectedKhuVuc, selectedNVBH, selectedKHs, selectedThu]);



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
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Khu vực</div>
          <Select
            placeholder="Chọn khu vực"
            value={selectedKhuVuc}
            onChange={setSelectedKhuVuc}
            showSearch
            optionFilterProp="label"
            options={khuVucOptions}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>NVBH</div>
          <Select
            placeholder="Chọn NVBH"
            value={selectedNVBH}
            onChange={setSelectedNVBH}
            showSearch
            optionFilterProp="label"
            options={nvbhOptions}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 2, minWidth: 240 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Tìm KH (Mã - Tên)</div>
          <Select
            mode="multiple"
            placeholder="Tìm theo Mã hoặc Tên KH"
            value={selectedKHs}
            onChange={setSelectedKHs}
            options={khOptions}
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            maxTagCount="responsive"
          />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Thứ</div>
          <Select
            placeholder="Tất cả"
            value={selectedThu}
            onChange={setSelectedThu}
            options={thuOptionsFiltered}
            allowClear
            style={{ width: '100%' }}
          />
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
            getCheckboxProps: (record) => ({
              disabled: !modifiedRows[record.Mã_KH],
            }),
          }}
          pagination={{
            pageSize,
            onChange: (page, size) => setPageSize(size),
            showSizeChanger: true,
            pageSizeOptions: [100, 500, 1000],
            showTotal: (total, range) => (
              <span>
                {range[0]}-{range[1]} / {total} — Hiển thị: <b>{filteredData.length}</b> / {data.length} khách hàng
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
              onOk: () => exportExcel(filteredData),
            });
          }}
          disabled={filteredData.length === 0}
          loading={loading}
        >
          Xuất Excel
        </Button>

        <Button
          icon={<PauseCircleOutlined />}
          onClick={() => {
            if (selectedRowKeys.length === 0) {
              Modal.warning({
                title: 'Chưa chọn khách hàng',
                content: 'Hãy tick chọn các khách hàng bạn muốn điều chỉnh tuyến để tải về.',
              });
              return;
            }
            setDieuChinhModalOpen(true);
          }}
          danger={selectedRowKeys.length > 0}
        >
          Điều chỉnh tuyến ({selectedRowKeys.length})
        </Button>
      </div>

      {/* Modal Điều chỉnh tuyến */}
      <Modal
        title="Điều chỉnh tuyến"
        open={dieuChinhModalOpen}
        onCancel={() => setDieuChinhModalOpen(false)}
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
                  const rows = selected.map((r) => {
                    const mods = modifiedRows[r.Mã_KH] || {};
                    return {
                      Khu_vuc: r.Khu_Vực,
                      Ma_KH: r.Mã_KH,
                      Ten_KH: r.Tên_KH,
                      DC: r.Địa_Chỉ,
                      // Cũ
                      Ma_ten_nvbh_CU: r.Mã_Tên_NVBH,
                      Thu_CU: r.Thứ,
                      Tan_suat_CU: r.Tần_Suất,
                      // Mới
                      Ma_ten_nvbh_MOI: mods.Mã_Tên_NVBH ?? r.Mã_Tên_NVBH,
                      Thu_MOI: mods.Thứ ?? r.Thứ,
                      Tan_suat_MOI: mods.Tần_Suất ?? r.Tần_Suất,
                    };
                  });
                  const username = getCookie('username') || '';
                  const res = await fetch('/api/dangky-dieuchinhtuyen', {
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
                    setDieuChinhModalOpen(false);

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
              Gửi Manager duyệt ĐCT
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setDieuChinhModalOpen(false)}>Hủy</Button>
            </div>
          </div>
        }
        centered
      >
        <p>Bạn đã chọn <b>{selectedRowKeys.length}</b> khách hàng điều chỉnh tuyến.</p>
        <p>Chọn hành động:</p>
        <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
          <li><b>Gửi Manager duyệt ĐCT</b>: Gửi danh sách cho Manager xét duyệt</li>

        </ul>
      </Modal>
    </div>
  );
}
