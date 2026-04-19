import React, { useEffect, useState, useMemo } from 'react';
import { Spin, Tag, Select, Button, message, Typography, Tooltip, Modal, notification } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, DownloadOutlined, ExclamationCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getCacheMeta, getStoreData } from '../../../../utils/indexedDB';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, THU_OPTIONS, THU_LIST } from '../../../../constants';

const { Text } = Typography;

interface RecordType {
  ID: number;
  Khu_vuc: string;
  Ma_KH: string;
  Ten_KH: string;
  DC: string;
  Ma_ten_nvbh_CU: string;
  Thu_CU: string;
  Tan_suat_CU: string;
  Ma_ten_nvbh_MOI: string;
  Thu_MOI: string;
  Tan_suat_MOI: string;
  Nguoi_dang_ky: string;
  Ngay_dang_ky: string;
  Trang_thai_duyet: string;
  Nguoi_duyet: string | null;
  Ngay_duyet: string | null;
}

const trangThaiColors: Record<string, string> = {
  'Chờ duyệt': 'orange',
  'Đã duyệt': 'green',
  'Từ chối': 'red'
};

export default function DuyetChinhModule() {
  const [data, setData] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
  const [selectedNVBH, setSelectedNVBH] = useState<string | undefined>();
  const [selectedThu, setSelectedThu] = useState<string | undefined>();
  const [selectedTrangThai, setSelectedTrangThai] = useState<string | undefined>('Chờ duyệt');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [cachedKhuVuc, setCachedKhuVuc] = useState<string[]>([]);
  const [cachedNVBH, setCachedNVBH] = useState<{ MA_TEN_NVBH: string, TEN_KHUVUC: string }[]>([]);

  // Load danh mục từ Cache
  useEffect(() => {
    const loadCache = async () => {
      try {
        const { getCacheMeta } = await import('../../../../utils/indexedDB');
        const kv = await getCacheMeta('common_khuvuc');
        const nv = await getCacheMeta('common_nvbh');

        if (kv) setCachedKhuVuc(JSON.parse(kv));
        if (nv) setCachedNVBH(JSON.parse(nv));
      } catch (e) {
        console.error('Load cache error:', e);
      }
    };
    loadCache();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setLoadingText('Đang tải danh sách chờ duyệt...');
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

      const res = await fetch(`/api/khach-hang/chinh-tuyen?quyen_dl=${encodeURIComponent(quyenQL)}&_t=${Date.now()}`);
      const json = await res.json();
      if (json.data) setData(json.data);
    } catch (e) {
      console.error('Fetch error:', e);
      setData([]);
      message.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const handleAction = async (trangThai: 'Đã duyệt' | 'Từ chối') => {
    const isApprove = trangThai === 'Đã duyệt';
    const label = isApprove ? 'duyệt' : 'từ chối';

    Modal.confirm({
      title: <Text strong style={{ fontSize: 16 }}>Xác nhận {label} yêu cầu</Text>,
      icon: isApprove ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      width: 450,
      centered: true,
      content: (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 16 }}>
            Bạn đang thực hiện {label} cho <Text strong style={{ color: isApprove ? '#52c41a' : '#ff4d4f' }}>{selectedRowKeys.length}</Text> yêu cầu điều chỉnh tuyến đã chọn.
          </div>
          <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: 8, fontSize: 13 }}>
            • Hành động này sẽ cập nhật trạng thái của các đơn hàng thành <Tag color={isApprove ? 'green' : 'red'}>{trangThai.toUpperCase()}</Tag>.<br />
            • Sau khi thực hiện, dữ liệu sẽ được đồng bộ ngay lập tức.
          </div>
        </div>
      ),
      okText: `Xác nhận ${label}`,
      cancelText: 'Hủy bỏ',
      okButtonProps: {
        danger: !isApprove,
        size: 'large',
        style: { borderRadius: 6, backgroundColor: isApprove ? '#52c41a' : undefined, borderColor: isApprove ? '#52c41a' : undefined }
      },
      cancelButtonProps: { size: 'large', style: { borderRadius: 6 } },
      onOk: async () => {
        setApproving(true);
        try {
          let username = 'Admin';
          const userInfoStr = localStorage.getItem('user_info');
          if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            username = userInfo.username || 'Admin';
          }

          const res = await fetch('/api/khach-hang/chinh-tuyen', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedRowKeys, trang_thai: trangThai, nguoi_duyet: username }),
          });

          const json = await res.json();
          if (json.success) {
            notification.success({
              message: `Thực hiện ${label} thành công`,
              description: `Đã xử lý xong ${selectedRowKeys.length} yêu cầu.`,
              placement: 'bottomRight'
            });
            setSelectedRowKeys([]);
            await fetchData();
          } else {
            message.error(json.error || `Lỗi khi thực hiện ${label}`);
          }
        } catch (e) {
          console.error('Action error:', e);
          message.error('Lỗi kết nối Server');
        } finally {
          setApproving(false);
        }
      }
    });
  };

  const handleDelete = async () => {
    Modal.confirm({
      title: <Text strong style={{ fontSize: 16 }}>Xác nhận xóa yêu cầu</Text>,
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: `Bạn muốn xóa ${selectedRowKeys.length} yêu cầu điều chỉnh tuyến đã chọn? Hành động này không thể hoàn tác.`,
      okText: 'Xóa ngay',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        setDeleting(true);
        try {
          const res = await fetch('/api/khach-hang/chinh-tuyen', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedRowKeys }),
          });
          const json = await res.json();
          if (json.success) {
            message.success(`Đã xóa thành công ${json.deleted} bản ghi!`);
            setSelectedRowKeys([]);
            await fetchData();
          } else message.error(json.error);
        } catch { message.error('Lỗi kết nối'); } finally { setDeleting(false); }
      },
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };

  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (selectedKhuVuc && r.Khu_vuc !== selectedKhuVuc) return false;
      if (selectedNVBH && r.Ma_ten_nvbh_MOI !== selectedNVBH) return false;
      if (selectedThu && r.Thu_MOI !== selectedThu) return false;
      if (selectedTrangThai && r.Trang_thai_duyet !== selectedTrangThai) return false;
      return true;
    });
  }, [data, selectedKhuVuc, selectedNVBH, selectedThu, selectedTrangThai]);

  const columns: ColumnsType<RecordType> = [
    { title: 'STT', key: 'stt', width: 45, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Khu vực', dataIndex: 'Khu_vuc', key: 'Khu_vuc', width: 90, align: 'center' },
    {
      title: 'Khách hàng', key: 'kh', width: 200, align: 'left',
      render: (_, r) => (
        <Tooltip title={`${r.Ma_KH} - ${r.Ten_KH}`} mouseEnterDelay={0.5}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <Text strong style={{ color: '#1677ff', fontSize: 13, marginRight: 4 }}>{r.Ma_KH}</Text>
            <Text style={{ fontSize: 12 }}> - {r.Ten_KH}</Text>
          </div>
        </Tooltip>
      )
    },
    { title: 'Địa chỉ', dataIndex: 'DC', key: 'DC', width: 200, align: 'left', render: v => <Text style={{ fontSize: 12 }}>{v}</Text> },
    {
      title: 'Nhân viên (Cũ/Mới)', key: 'nvbh', width: 220, align: 'left',
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text delete type="secondary" style={{ fontSize: 12, color: '#ff4d4f' }}>{r.Ma_ten_nvbh_CU}</Text>
          <Text strong style={{ fontSize: 12, color: '#1677ff' }}>{r.Ma_ten_nvbh_MOI}</Text>
        </div>
      )
    },
    {
      title: 'Thứ', key: 'thu', width: 80, align: 'center',
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text delete style={{ fontSize: 12, color: '#ff4d4f' }}>{r.Thu_CU}</Text>
          <Text strong style={{ fontSize: 12, color: '#1677ff' }}>{r.Thu_MOI}</Text>
        </div>
      )
    },
    {
      title: 'Tần suất', key: 'ts', width: 80, align: 'center',
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text delete style={{ fontSize: 12, color: '#ff4d4f' }}>{r.Tan_suat_CU}</Text>
          <Text strong style={{ fontSize: 12, color: '#1677ff' }}>{r.Tan_suat_MOI}</Text>
        </div>
      )
    },
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
        <div style={{ flex: 1, maxWidth: 200 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Khu vực</div>
          <Select
            placeholder="Tất cả"
            value={selectedKhuVuc}
            onChange={v => { setSelectedKhuVuc(v); setSelectedNVBH(undefined); }}
            allowClear showSearch
            options={cachedKhuVuc.map(v => ({ label: v, value: v }))}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, maxWidth: 220 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>NVBH</div>
          <Select
            placeholder="Tất cả"
            value={selectedNVBH}
            onChange={setSelectedNVBH}
            allowClear showSearch
            options={cachedNVBH.filter(n => !selectedKhuVuc || n.TEN_KHUVUC === selectedKhuVuc).map(n => ({ label: n.MA_TEN_NVBH, value: n.MA_TEN_NVBH }))}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ width: 90 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Thứ</div>
          <Select
            placeholder="Tất cả"
            value={selectedThu}
            onChange={setSelectedThu}
            allowClear
            options={THU_OPTIONS}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ width: 120 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Trạng thái</div>
          <Select
            placeholder="Tất cả"
            value={selectedTrangThai}
            onChange={setSelectedTrangThai}
            allowClear
            options={[{ label: 'Chờ duyệt', value: 'Chờ duyệt' }, { label: 'Đã duyệt', value: 'Đã duyệt' }, { label: 'Từ chối', value: 'Từ chối' }, { label: 'Tất cả', value: '' }]}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1.2 }}></div>
      </div>

      <Spin spinning={loading} description={loadingText} classNames={{ root: "flex-1 overflow-hidden" }}>
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
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={fetchData}
        >
          Tải lại
        </Button>
        <Tooltip title={selectedRowKeys.length === 0 ? "Hãy Tick chọn yêu cầu cần phê duyệt" : ""}>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            disabled={selectedRowKeys.length === 0}
            loading={approving}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            onClick={() => handleAction('Đã duyệt')}
          >
            Duyệt ({selectedRowKeys.length})
          </Button>
        </Tooltip>
        <Tooltip title={selectedRowKeys.length === 0 ? "Hãy Tick chọn yêu cầu cần từ chối" : ""}>
          <Button
            danger
            icon={<CloseCircleOutlined />}
            disabled={selectedRowKeys.length === 0}
            loading={approving}
            onClick={() => handleAction('Từ chối')}
          >
            Từ chối ({selectedRowKeys.length})
          </Button>
        </Tooltip>
        <Tooltip title={selectedRowKeys.length === 0 ? "Hãy Tick chọn yêu cầu cần xóa" : ""}>
          <Button
            danger
            ghost
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            loading={deleting}
            onClick={handleDelete}
          >
            Xóa ({selectedRowKeys.length})
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
