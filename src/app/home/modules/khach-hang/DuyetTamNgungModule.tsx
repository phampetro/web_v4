import React, { useEffect, useState, useMemo } from 'react';
import { Spin, Tag, Select, Button, Modal, message, Typography, Tooltip } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getCookie } from '../../../../utils/cookie';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../../../constants';

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

const trangThaiColors: Record<string, string> = {
  'Chờ duyệt': 'orange',
  'Đã duyệt': 'green',
  'Từ chối': 'red',
};

export default function DuyetTamNgungModule() {
  const [data, setData] = useState<TamNgungRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [approving, setApproving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
  const [selectedNVBH, setSelectedNVBH] = useState<string | undefined>();
  const [selectedTrangThai, setSelectedTrangThai] = useState<string | undefined>('Chờ duyệt');

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

  const [loadingText, setLoadingText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setLoadingText('Đang tải dữ liệu mới từ Server...');
    try {
      const { getCacheMeta } = await import('../../../../utils/indexedDB');
      let quyenQL = (await getCacheMeta('common_quyen_dl')) || '';

      if (!quyenQL) {
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          quyenQL = userInfo.quyenDL || '';
        }
      }
      // Thêm timestamp để force refresh từ server
      const res = await fetch(`/api/khach-hang/tam-ngung?quyen_dl=${encodeURIComponent(quyenQL)}&_t=${Date.now()}`);
      const json = await res.json();
      if (json.data) setData(json.data);
    } catch {
      setData([]);
      message.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const khuVucOptions = useMemo(() => {
    const list = cachedKhuVuc.length > 0 ? cachedKhuVuc : [...new Set(data.map((r) => r.Khu_vuc).filter(Boolean))].sort();
    return list.map((v) => ({ label: v, value: v }));
  }, [data, cachedKhuVuc]);

  const nvbhOptions = useMemo(() => {
    // Ưu tiên dùng cache tập trung để giữ quan hệ cha-con
    if (cachedNVBH.length > 0) {
      let filtered = cachedNVBH;
      if (selectedKhuVuc) {
        filtered = cachedNVBH.filter(n => n.TEN_KHUVUC === selectedKhuVuc);
      }
      return filtered.map(n => ({ label: n.MA_TEN_NVBH, value: n.MA_TEN_NVBH }));
    }

    // Fallback: Lấy từ data hiện tại
    let list: string[] = [];
    if (selectedKhuVuc) {
      list = [...new Set(data.filter(r => r.Khu_vuc === selectedKhuVuc).map(r => r.Ma_ten_nvbh).filter(Boolean))].sort();
    } else {
      list = [...new Set(data.map(r => r.Ma_ten_nvbh).filter(Boolean))].sort();
    }
    return list.map((v) => ({ label: v, value: v }));
  }, [data, selectedKhuVuc, cachedNVBH]);

  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (selectedKhuVuc && r.Khu_vuc !== selectedKhuVuc) return false;
      if (selectedNVBH && r.Ma_ten_nvbh !== selectedNVBH) return false;
      if (selectedTrangThai && r.Trang_thai_duyet !== selectedTrangThai) return false;
      return true;
    }).sort((a, b) => new Date(b.Ngay_dang_ky).getTime() - new Date(a.Ngay_dang_ky).getTime());
  }, [data, selectedKhuVuc, selectedNVBH, selectedTrangThai]);

  const handleAction = async (trangThai: 'Đã duyệt' | 'Từ chối') => {
    const label = trangThai === 'Đã duyệt' ? 'duyệt' : 'từ chối';
    Modal.confirm({
      title: `Xác nhận ${label}`,
      content: `Bạn muốn ${label} ${selectedRowKeys.length} đăng ký đã chọn?`,
      onOk: async () => {
        setApproving(true);
        try {
          let username = 'Admin';
          const userInfoStr = localStorage.getItem('user_info');
          if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            username = userInfo.username || 'Admin';
          }
          const res = await fetch('/api/khach-hang/tam-ngung', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedRowKeys, trang_thai: trangThai, nguoi_duyet: username }),
          });
          const json = await res.json();
          if (json.success) {
            message.success(`Đã ${label} thành công!`);
            setSelectedRowKeys([]);
            await fetchData();
          } else message.error(json.error);
        } catch { message.error('Lỗi kết nối'); } finally { setApproving(false); }
      },
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };

  const columns: ColumnsType<TamNgungRecord> = [
    { title: 'STT', key: 'stt', width: 45, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Khu vực', dataIndex: 'Khu_vuc', key: 'Khu_vuc', width: 80, align: 'center' },
    {
      title: 'Khách hàng', key: 'kh', width: 210, align: 'left',
      render: (_, r) => (
        <Tooltip title={`${r.Ma_KH} - ${r.Ten_KH}`} mouseEnterDelay={0.5}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <Text strong style={{ color: '#1677ff', fontSize: 13, marginRight: 4 }}>{r.Ma_KH}</Text>
            <Text style={{ fontSize: 12 }}> - {r.Ten_KH}</Text>
          </div>
        </Tooltip>
      )
    },
    { title: 'Địa chỉ', dataIndex: 'DC', key: 'DC', width: 210, align: 'left' },
    { title: 'NVBH', dataIndex: 'Ma_ten_nvbh', key: 'Ma_ten_nvbh', width: 210, align: 'left' },
    { title: 'Thứ', dataIndex: 'Thu', key: 'Thu', width: 40, align: 'center' },
    { title: 'Tần suất', dataIndex: 'Tan_suat', key: 'Tan_suat', width: 75, align: 'center' },
    {
      title: 'Người ĐK', key: 'meta_dk', width: 120, align: 'center',
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 12, color: '#8c8c8c' }}>{r.Nguoi_dang_ky}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(r.Ngay_dang_ky)}</Text>
        </div>
      )
    },
    { title: 'Trạng thái', dataIndex: 'Trang_thai_duyet', key: 'Trang_thai_duyet', width: 100, align: 'center', render: v => <Tag color={trangThaiColors[v]}>{v}</Tag> },
    {
      title: 'Xử lý', key: 'meta_duyet', width: 100, align: 'center',
      render: (_, r) => r.Ngay_duyet ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 12, color: '#595959' }}>{r.Nguoi_duyet}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(r.Ngay_duyet)}</Text>
        </div>
      ) : <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 12 }}>Chờ xử lý</Text>
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'nowrap', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Khu vực</div>
          <Select placeholder="Tất cả" value={selectedKhuVuc} onChange={v => { setSelectedKhuVuc(v); setSelectedNVBH(undefined); }} allowClear showSearch options={khuVucOptions} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>NVBH</div>
          <Select placeholder="Tất cả" value={selectedNVBH} onChange={setSelectedNVBH} allowClear showSearch options={nvbhOptions} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Trạng thái</div>
          <Select placeholder="Tất cả" value={selectedTrangThai} onChange={setSelectedTrangThai} allowClear options={[{ label: 'Chờ duyệt', value: 'Chờ duyệt' }, { label: 'Đã duyệt', value: 'Đã duyệt' }, { label: 'Từ chối', value: 'Từ chối' }, { label: 'Tất cả', value: '' }]} style={{ width: '100%' }} />
        </div>
      </div>

      <Spin spinning={loading} description={loadingText}>
        <CustomTable
          columns={columns}
          dataSource={filteredData}
          rowKey="ID"
          rowSelection={{ 
            selectedRowKeys, 
            onChange: setSelectedRowKeys,
            getCheckboxProps: r => ({ disabled: r.Trang_thai_duyet !== 'Chờ duyệt' })
          }}
          onRow={(record) => ({
            onClick: () => {
              if (record.Trang_thai_duyet !== 'Chờ duyệt') return;
              const key = record.ID;
              const newKeys = [...selectedRowKeys];
              const idx = newKeys.indexOf(key);
              if (idx >= 0) newKeys.splice(idx, 1);
              else newKeys.push(key);
              setSelectedRowKeys(newKeys);
            },
            style: { cursor: record.Trang_thai_duyet === 'Chờ duyệt' ? 'pointer' : 'default' }
          })}
          pagination={{
            pageSize,
            onChange: (_, size) => setPageSize(size),
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (total, range) => <span>{range[0]}-{range[1]} / {total} — Đang hiện: <b>{filteredData.length}</b> đơn</span>
          }}
        />
      </Spin>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Tải lại</Button>
        <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleAction('Đã duyệt')} loading={approving} disabled={selectedRowKeys.length === 0} style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}>Duyệt ({selectedRowKeys.length})</Button>
        <Button danger icon={<CloseCircleOutlined />} onClick={() => handleAction('Từ chối')} loading={approving} disabled={selectedRowKeys.length === 0}>Từ chối ({selectedRowKeys.length})</Button>
      </div>
    </div>
  );
}
