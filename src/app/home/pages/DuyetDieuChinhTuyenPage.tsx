import React, { useEffect, useState, useMemo } from 'react';
import { Spin, Tag, Select, Button, Modal, message, Space, Typography, Table } from 'antd';
import CustomTable from '../../../components/CustomTable';
import type { ColumnsType } from 'antd/es/table';
import { getCookie } from '../../../utils/cookie';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, ArrowRightOutlined, DownloadOutlined, EnvironmentOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface DieuChinhRecord {
  ID: number;
  Khu_vuc: string;
  Ma_KH: string;
  Ten_KH: string;
  DC: string;
  // Cũ
  Ma_ten_nvbh_CU: string;
  Thu_CU: string;
  Tan_suat_CU: string;
  // Mới
  Ma_ten_nvbh_MOI: string;
  Thu_MOI: string;
  Tan_suat_MOI: string;
  // Meta
  Nguoi_dang_ky: string | null;
  Ngay_dang_ky: string;
  Trang_thai_duyet: string;
  Nguoi_duyet: string | null;
  Ngay_duyet: string | null;
}

const PAGE_SIZE = 15;

const trangThaiColors: Record<string, string> = {
  'Chờ duyệt': 'orange',
  'Đã duyệt': 'green',
  'Từ chối': 'red',
};

export default function DuyetDieuChinhTuyenPage({ ngayUpdate, setNgayUpdate }: { ngayUpdate: string, setNgayUpdate: (d: string) => void }) {
  const [data, setData] = useState<DieuChinhRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [approving, setApproving] = useState(false);
  const [pageSize, setPageSize] = useState(100);

  // Filters
  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string>();
  const [selectedNVBH, setSelectedNVBH] = useState<string>();
  const [selectedTrangThai, setSelectedTrangThai] = useState<string>('Chờ duyệt');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const quyenQL = getCookie('quyen_dl') || '';
      const res = await fetch(`/api/dangky-dieuchinhtuyen?quyen_dl=${encodeURIComponent(quyenQL)}`);
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

  const khuVucOptions = useMemo(() => {
    const list = Array.from(new Set(data.map(d => d.Khu_vuc))).filter(Boolean);
    return list.map(k => ({ label: k, value: k }));
  }, [data]);

  const nvbhOptions = useMemo(() => {
    const list = Array.from(new Set([
      ...data.map(d => d.Ma_ten_nvbh_CU),
      ...data.map(d => d.Ma_ten_nvbh_MOI)
    ])).filter(Boolean);
    return list.map(n => ({ label: n, value: n }));
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (selectedKhuVuc && d.Khu_vuc !== selectedKhuVuc) return false;
      if (selectedNVBH && d.Ma_ten_nvbh_CU !== selectedNVBH && d.Ma_ten_nvbh_MOI !== selectedNVBH) return false;
      if (selectedTrangThai && d.Trang_thai_duyet !== selectedTrangThai) return false;
      return true;
    });
  }, [data, selectedKhuVuc, selectedNVBH, selectedTrangThai]);

  const handleAction = (trangThai: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('Vui lòng chọn yêu cầu cần xử lý');
      return;
    }

    const label = trangThai === 'Đã duyệt' ? 'duyệt' : 'từ chối';
    Modal.confirm({
      title: `Xác nhận ${label}`,
      content: `Bạn muốn ${label} ${selectedRowKeys.length} yêu cầu điều chỉnh đã chọn?`,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      onOk: async () => {
        setApproving(true);
        try {
          const nguoi_duyet = getCookie('username') || '';
          const res = await fetch('/api/duyet-dieuchinhtuyen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedRowKeys, trang_thai: trangThai, nguoi_duyet }),
          });
          const json = await res.json();
          if (json.success) {
            message.success(`Đã ${label} thành công!`);
            setSelectedRowKeys([]);
            fetchData();
          } else {
            message.error(json.error || 'Có lỗi xảy ra');
          }
        } catch {
          message.error('Lỗi kết nối');
        } finally {
          setApproving(false);
        }
      },
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Xuất Excel
  const exportExcel = async (rows: DieuChinhRecord[]) => {
    setLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Duyệt điều chỉnh');

      const ngayRaw = getCookie('ngay_update') || ngayUpdate || '';
      const ngayStr = ngayRaw ? new Date(ngayRaw).toLocaleDateString('vi-VN') : '';

      const columnsDef = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Khu vực', key: 'khu_vuc', width: 15 },
        { header: 'Mã KH', key: 'ma_kh', width: 15 },
        { header: 'Tên KH', key: 'ten_kh', width: 35 },
        { header: 'NVBH Cũ', key: 'nvbh_cu', width: 30 },
        { header: 'NVBH Mới', key: 'nvbh_moi', width: 30 },
        { header: 'Thứ Cũ', key: 'thu_cu', width: 15 },
        { header: 'Thứ Mới', key: 'thu_moi', width: 15 },
        { header: 'Người ĐK', key: 'nguoi_dk', width: 15 },
        { header: 'Trạng thái', key: 'trang_thai', width: 15 },
      ];
      sheet.columns = columnsDef;
      sheet.spliceRows(1, 0, ...Array(3).fill([]));

      sheet.mergeCells('A1:J1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'DANH SÁCH DUYỆT ĐIỀU CHỈNH TUYẾN';
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet.mergeCells('A2:J2');
      const filterCell = sheet.getCell('A2');
      filterCell.value = `Ngày cập nhật: ${ngayStr} | Trạng thái: ${selectedTrangThai || 'Tất cả'}`;
      filterCell.alignment = { horizontal: 'center' };

      const excelHeaderRow = sheet.getRow(4);
      excelHeaderRow.font = { bold: true };
      excelHeaderRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      rows.forEach((r, idx) => {
        const row = sheet.addRow({
          stt: idx + 1,
          khu_vuc: r.Khu_vuc,
          ma_kh: r.Ma_KH,
          ten_kh: r.Ten_KH,
          nvbh_cu: r.Ma_ten_nvbh_CU,
          nvbh_moi: r.Ma_ten_nvbh_MOI,
          thu_cu: r.Thu_CU,
          thu_moi: r.Thu_MOI,
          nguoi_dk: r.Nguoi_dang_ky,
          trang_thai: r.Trang_thai_duyet,
        });
        row.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Duyet_Dieu_Chinh_${new Date().getTime()}.xlsx`);
    } catch (e) {
      console.error(e);
      message.error('Lỗi xuất Excel');
    } finally {
      setLoading(false);
    }
  };

  const renderCompare = (oldVal: string, newVal: string) => {
    if (!oldVal && !newVal) return '-';
    if (oldVal === newVal) return <Text type="secondary" style={{ fontSize: 13 }}>{oldVal}</Text>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
        <Tag color="default" style={{ margin: 0, fontSize: 11, opacity: 0.7, textDecoration: 'line-through' }}>{oldVal || 'Trống'}</Tag>
        <Tag color="processing" style={{ margin: 0, fontSize: 12, fontWeight: 500, border: 'none', background: '#e6f4ff', color: '#1677ff' }}>
          {newVal || 'Trống'}
        </Tag>
      </div>
    );
  };

  const renderSimpleCompare = (oldVal: string, newVal: string) => {
    if (!oldVal && !newVal) return '-';
    if (oldVal === newVal) return <div style={{ textAlign: 'center' }}><Text type="secondary" style={{ fontSize: 13 }}>{oldVal}</Text></div>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
        <Tag color="default" style={{ margin: 0, fontSize: 11, opacity: 0.7, textDecoration: 'line-through' }}>{oldVal || 'Trống'}</Tag>
        <Tag color="processing" style={{ margin: 0, fontSize: 12, fontWeight: 500, border: 'none', background: '#e6f4ff', color: '#1677ff' }}>
          {newVal || 'Trống'}
        </Tag>
      </div>
    );
  };

  const columns: ColumnsType<DieuChinhRecord> = [
    {
      title: 'STT', key: 'stt', width: 50, align: 'center',
      render: (_, __, index) => index + 1,
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
      title: 'Điều chỉnh NVBH', key: 'nvbh', width: 180, align: 'center',
      render: (_, r) => renderCompare(r.Ma_ten_nvbh_CU, r.Ma_ten_nvbh_MOI)
    },
    {
      title: 'Thứ', key: 'thu', width: 100, align: 'center',
      render: (_, r) => renderSimpleCompare(r.Thu_CU, r.Thu_MOI)
    },
    {
      title: 'Tần suất', key: 'tan_suat', width: 85, align: 'center',
      render: (_, r) => renderSimpleCompare(r.Tan_suat_CU, r.Tan_suat_MOI)
    },
    {
      title: 'Thông tin ĐK', key: 'meta_dk', width: 120, align: 'center',
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
            onChange={setSelectedKhuVuc}
            options={khuVucOptions}
            allowClear
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>NVBH</div>
          <Select
            placeholder="Tất cả"
            value={selectedNVBH}
            onChange={setSelectedNVBH}
            options={nvbhOptions}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Trạng thái</div>
          <Select
            value={selectedTrangThai}
            onChange={setSelectedTrangThai}
            options={[
              { label: 'Chờ duyệt', value: 'Chờ duyệt' },
              { label: 'Đã duyệt', value: 'Đã duyệt' },
              { label: 'Từ chối', value: 'Từ chối' },
              { label: 'Tất cả', value: '' },
            ]}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <Spin spinning={loading} description="Đang tải dữ liệu...">
        <CustomTable
          className="kh-table"
          dataSource={filteredData}
          columns={columns}
          rowKey="ID"
          bordered
          tableLayout="fixed"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (record) => ({
              disabled: record.Trang_thai_duyet !== 'Chờ duyệt',
            }),
          }}
          pagination={{
            pageSize,
            onChange: (page, size) => setPageSize(size),
            showTotal: (total, range) => (
              <span>
                {range[0]}-{range[1]} / {total} — Hiển thị: <b>{filteredData.length}</b> / {data.length} bản ghi
              </span>
            )
          }}
        />
      </Spin>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
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
          loading={loading}
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

