import React, { useEffect, useState, useMemo } from 'react';
import { Spin, Tag, Select, Button, Modal, message, Typography } from 'antd';
import CustomTable from '../../../components/CustomTable';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getCookie } from '../../../utils/cookie';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Text } = Typography;

interface TamNgungRecord {
  ID: number;
  Khu_vuc: string;
  Ma_ten_nvbh: string;
  Ma_KH: string;
  Ten_KH: string;
  DC: string;
  Thu: string;
  Tan_suat: string;
  Ngay_dang_ky: string;
  Ngay_duyet: string | null;
  Nguoi_duyet: string | null;
  Trang_thai_duyet: string;
  Nguoi_dang_ky: string | null;
}

const PAGE_SIZE = 15;

const trangThaiColors: Record<string, string> = {
  'Chờ duyệt': 'orange',
  'Đã duyệt': 'green',
  'Từ chối': 'red',
};

interface Props {
  ngayUpdate: string;
  setNgayUpdate: (d: string) => void;
}

export default function DuyetTamNgungPage({ ngayUpdate, setNgayUpdate }: Props) {
  const [data, setData] = useState<TamNgungRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [approving, setApproving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageSize, setPageSize] = useState(100);

  // Filters
  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
  const [selectedNVBH, setSelectedNVBH] = useState<string | undefined>();
  const [selectedTrangThai, setSelectedTrangThai] = useState<string | undefined>('Chờ duyệt');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const quyenQL = getCookie('quyen_dl') || '';
      const res = await fetch(`/api/dangky-tamngung?quyen_dl=${encodeURIComponent(quyenQL)}`);
      const json = await res.json();
      if (json.data) {
        setData(json.data);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Options cho filters
  const khuVucOptions = useMemo(() => {
    const unique = Array.from(new Set(data.map((r) => r.Khu_vuc).filter(Boolean))).sort();
    return unique.map((v) => ({ label: v, value: v }));
  }, [data]);

  const nvbhOptions = useMemo(() => {
    let filtered = data;
    if (selectedKhuVuc) filtered = filtered.filter((r) => r.Khu_vuc === selectedKhuVuc);
    const unique = Array.from(new Set(filtered.map((r) => r.Ma_ten_nvbh).filter(Boolean))).sort();
    return unique.map((v) => ({ label: v, value: v }));
  }, [data, selectedKhuVuc]);

  const trangThaiOptions = [
    { label: 'Chờ duyệt', value: 'Chờ duyệt' },
    { label: 'Đã duyệt', value: 'Đã duyệt' },
    { label: 'Từ chối', value: 'Từ chối' },
    { label: 'Tất cả', value: '' },
  ];

  // Lọc data
  const filteredData = useMemo(() => {
    return data.filter((r) => {
      if (selectedKhuVuc && r.Khu_vuc !== selectedKhuVuc) return false;
      if (selectedNVBH && r.Ma_ten_nvbh !== selectedNVBH) return false;
      if (selectedTrangThai && r.Trang_thai_duyet !== selectedTrangThai) return false;
      return true;
    }).sort((a, b) =>
      new Date(b.Ngay_dang_ky).getTime() - new Date(a.Ngay_dang_ky).getTime()
    );
  }, [data, selectedKhuVuc, selectedNVBH, selectedTrangThai]);

  // Xử lý duyệt / từ chối
  const handleAction = async (trangThai: 'Đã duyệt' | 'Từ chối') => {
    if (selectedRowKeys.length === 0) {
      Modal.warning({
        title: 'Chưa chọn bản ghi',
        content: 'Hãy tick chọn các đăng ký cần xử lý.',
      });
      return;
    }

    const label = trangThai === 'Đã duyệt' ? 'duyệt' : 'từ chối';
    Modal.confirm({
      title: `Xác nhận ${label}`,
      content: `Bạn muốn ${label} ${selectedRowKeys.length} đăng ký tạm ngưng đã chọn?`,
      okText: trangThai === 'Đã duyệt' ? 'Duyệt' : 'Từ chối',
      okType: trangThai === 'Đã duyệt' ? 'primary' : 'default',
      okButtonProps: trangThai === 'Từ chối' ? { danger: true } : {},
      cancelText: 'Hủy',
      onOk: async () => {
        setApproving(true);
        try {
          const currentUser = getCookie('user_name') || 'Admin';
          const res = await fetch('/api/duyet-tamngung', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ids: selectedRowKeys,
              trang_thai: trangThai,
              nguoi_duyet: currentUser
            }),
          });
          const json = await res.json();
          if (json.success) {
            message.success(`Đã ${label} ${json.updated} bản ghi thành công!`);
            setSelectedRowKeys([]);
            await fetchData(); // refresh
          } else {
            message.error(json.error || 'Có lỗi xảy ra');
          }
        } catch {
          message.error('Lỗi kết nối server');
        } finally {
          setApproving(false);
        }
      },
    });
  };

  // Format ngày
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    // Dùng getUTC để không bị trình duyệt tự động cộng thêm múi giờ
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };

  const columns: ColumnsType<TamNgungRecord> = [
    {
      title: 'STT', key: 'stt', width: 50, align: 'center',
      render: (_v, _r, index) => index + 1,
    },
    { title: 'Khu vực', dataIndex: 'Khu_vuc', key: 'Khu_vuc', width: 90, align: 'left' },
    {
      title: 'Khách hàng', key: 'kh', width: 170, align: 'left',
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Text strong style={{ color: '#1677ff', fontSize: 13 }}>{r.Ma_KH}</Text>
          <Text style={{ fontSize: 12, color: '#262626', fontWeight: 500 }}>{r.Ten_KH}</Text>
        </div>
      )
    },
    {
      title: 'Địa chỉ', dataIndex: 'DC', key: 'DC', width: 200, align: 'left',
      render: (v) => (
        <Text style={{ fontSize: 12, color: '#434343' }} ellipsis={{ tooltip: v }}>
          {v}
        </Text>
      )
    },
    {
      title: 'NVBH', dataIndex: 'Ma_ten_nvbh', key: 'Ma_ten_nvbh', width: 180, align: 'left',
      render: (v) => (
        <Text style={{ fontSize: 12, color: '#434343' }} ellipsis={{ tooltip: v }}>
          {v}
        </Text>
      )
    },
    { title: 'Thứ', dataIndex: 'Thu', key: 'Thu', width: 60, align: 'center' },
    { title: 'Tần suất', dataIndex: 'Tan_suat', key: 'Tan_suat', width: 80, align: 'center' },
    {
      title: 'Người ĐK', key: 'meta_dk', width: 120, align: 'center',
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
          <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>{r.Nguoi_dang_ky}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(r.Ngay_dang_ky)}</Text>
        </div>
      )
    },
    {
      title: 'Trạng thái', dataIndex: 'Trang_thai_duyet', key: 'Trang_thai_duyet', width: 100, align: 'center',
      render: (v: string) => <Tag color={trangThaiColors[v] || 'default'} style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: 'Xử lý', key: 'meta_duyet', width: 130, align: 'center',
      render: (_, r) => r.Ngay_duyet ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
          <Text strong style={{ fontSize: 12, color: '#52c41a' }}>{r.Nguoi_duyet}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(r.Ngay_duyet)}</Text>
        </div>
      ) : <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 12 }}>Chờ xử lý</Text>
    },
  ];

  // Logic xuất Excel
  const exportExcel = async (dataToExport: TamNgungRecord[]) => {
    try {
      setExporting(true);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Danh sách Đăng ký');

      // Định dạng ngày header
      const ngayRaw = getCookie('ngay_update') || ngayUpdate || '';
      const ngayStr = ngayRaw ? new Date(ngayRaw).toLocaleDateString('vi-VN') : '';

      // Tính tổng hợp bộ lọc
      const displayKhuVuc = selectedKhuVuc || 'Tất cả';
      const displayNVBH = selectedNVBH || 'Tất cả';
      const displayTrangThai = selectedTrangThai || 'Tất cả';

      // 1. Tạo cột và header của bảng trước (mặc định ExcelJS sẽ đưa header cột vào dòng 1)
      const columnsDef = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Khu vực', key: 'khu_vuc', width: 15 },
        { header: 'NVBH', key: 'nvbh', width: 30 },
        { header: 'Mã KH', key: 'ma_kh', width: 15 },
        { header: 'Tên KH', key: 'ten_kh', width: 35 },
        { header: 'Địa chỉ', key: 'dc', width: 50 },
        { header: 'Thứ', key: 'thu', width: 10 },
        { header: 'Tần suất', key: 'tan_suat', width: 15 },
        { header: 'Người ĐK', key: 'nguoi_dk', width: 15 },
        { header: 'Ngày ĐK', key: 'ngay_dk', width: 20 },
        { header: 'Trạng thái', key: 'trang_thai', width: 15 },
        { header: 'Ngày duyệt', key: 'ngay_duyet', width: 20 },
      ];
      sheet.columns = columnsDef;

      // 2. Chèn 3 dòng trống lên trên cùng để đẩy header cột xuống dòng 4
      sheet.spliceRows(1, 0, [], [], []);

      // 3. Ghi thông tin Title vào các dòng trống vừa tạo
      sheet.mergeCells('A1:L1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'DANH SÁCH ĐĂNG KÝ TẠM NGƯNG KHÁCH HÀNG';
      titleCell.font = { bold: true, size: 16, color: { argb: 'FF000000' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.mergeCells('A2:L2');
      const filterCell = sheet.getCell('A2');
      filterCell.value = `Khu vực: ${displayKhuVuc} | NVBH: ${displayNVBH} | Trạng thái: ${displayTrangThai} | Ngày cập nhật: ${ngayStr}`;
      filterCell.font = { italic: true, size: 11, color: { argb: 'FF595959' } };
      filterCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // 4. Định dạng lại header cột (bây giờ đang nằm ở dòng 4)
      const excelHeaderRow = sheet.getRow(4);
      excelHeaderRow.font = { bold: true };
      excelHeaderRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });

      // 5. Thêm dữ liệu
      dataToExport.forEach((r, idx) => {
        const row = sheet.addRow({
          stt: idx + 1,
          khu_vuc: r.Khu_vuc,
          nvbh: r.Ma_ten_nvbh,
          ma_kh: r.Ma_KH,
          ten_kh: r.Ten_KH,
          dc: r.DC,
          thu: r.Thu,
          tan_suat: r.Tan_suat,
          nguoi_dk: r.Nguoi_dang_ky || '',
          ngay_dk: formatDate(r.Ngay_dang_ky),
          trang_thai: r.Trang_thai_duyet,
          ngay_duyet: formatDate(r.Ngay_duyet),
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
            // Bỏ qua 3 dòng tiêu đề phía trên
            if (rowNumber <= 3) return;
            const cellValue = cell.value ? cell.value.toString() : '';
            maxColumnLength = Math.max(maxColumnLength, cellValue.length);
          });
          column.width = Math.min(Math.max(maxColumnLength + 2, 10), 100);
        });
      }

      // Xuất file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'DanhSachDuyetTamNgung.xlsx');
    } catch (error) {
      console.error(error);
      message.error('Lỗi khi xuất Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
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
            onChange={(v) => { setSelectedKhuVuc(v); setSelectedNVBH(undefined); }}
            allowClear
            showSearch
            optionFilterProp="label"
            options={khuVucOptions}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>NVBH</div>
          <Select
            placeholder="Tất cả"
            value={selectedNVBH}
            onChange={setSelectedNVBH}
            allowClear
            showSearch
            optionFilterProp="label"
            options={nvbhOptions}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Trạng thái</div>
          <Select
            placeholder="Tất cả"
            value={selectedTrangThai}
            onChange={setSelectedTrangThai}
            allowClear
            options={trangThaiOptions}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <Spin spinning={loading} description="Đang tải dữ liệu...">
        <CustomTable
          className="kh-table"
          columns={columns}
          dataSource={filteredData}
          rowKey={(r) => r.ID}
          tableLayout="fixed"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            getCheckboxProps: (record) => ({
              disabled: record.Trang_thai_duyet !== 'Chờ duyệt',
            }),
          }}
          pagination={{
            pageSize,
            onChange: (page, size) => setPageSize(size),
            showSizeChanger: true,
            pageSizeOptions: [100, 500, 1000],
            showTotal: (total, range) => (
              <span>
                {range[0]}-{range[1]} / {total} — Hiển thị: <b>{filteredData.length}</b> / {data.length} bản ghi
              </span>
            )
          }}
        />
      </Spin>

      {/* Action bar */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchData}
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
          loading={exporting}
        >
          Xuất Excel
        </Button>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => handleAction('Đã duyệt')}
          loading={approving}
          disabled={selectedRowKeys.length === 0}
          style={selectedRowKeys.length > 0 ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {}}
        >
          Duyệt ({selectedRowKeys.length})
        </Button>
        <Button
          danger
          icon={<CloseCircleOutlined />}
          onClick={() => handleAction('Từ chối')}
          loading={approving}
          disabled={selectedRowKeys.length === 0}
        >
          Từ chối ({selectedRowKeys.length})
        </Button>
      </div>


    </div>
    <style jsx global>{`
      .kh-table .ant-table-tbody .ant-table-cell {
        display: flex !important;
        align-items: center !important;
        min-height: 48px !important;
      }
      .kh-table .ant-table-cell-align-left { justify-content: flex-start !important; }
      .kh-table .ant-table-cell-align-center { justify-content: center !important; }
    `}</style>
    </>
  );
}
