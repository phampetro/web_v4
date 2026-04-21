import React, { useEffect, useState, useMemo } from 'react';
import { Spin, Tag, Select, Button, message, Typography, Tooltip, Modal, notification, Flex } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, ExclamationCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../../../constants';
import { getStoreData, setStoreData } from '../../../../utils/indexedDB';

const { Text } = Typography;

interface RecordType {
  ID: number;
  Ma_KH: string;
  Ten_KH: string;
  Khu_vuc: string;
  NVBH: string;
  Dia_chi: string;
  Thu: string;
  Gia_tri_cu: string;
  Gia_tri_moi: string;
  Nguoi_dang_ky: string;
  Ngay_dang_ky: string;
  Trang_thai_duyet: string;
  Nguoi_duyet: string | null;
  Ngay_duyet: string | null;
  Ghi_chu: string | null;
}

const trangThaiColors: Record<string, string> = {
  'Chờ duyệt': 'orange',
  'Đã duyệt': 'green',
  'Từ chối': 'red'
};

export default function DuyetChoPhoModule({ ngayUpdate, setNgayUpdate }: { ngayUpdate: string, setNgayUpdate?: (d: string) => void }) {
  const [data, setData] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
  const [selectedNVBH, setSelectedNVBH] = useState<string | undefined>();
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

  const fetchData = async (isManual = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/khach-hang/cho-pho/approve?_t=${Date.now()}`);
      const json = await res.json();
      if (json.data) {
        setData(json.data);
        if (isManual) {
          message.success('Đã tải mới dữ liệu thành công!');
        }
      } else if (json.error) {
        message.error(json.error);
      }
    } catch (e) {
      message.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (action: 'Approve' | 'Reject') => {
    const isApprove = action === 'Approve';
    const label = isApprove ? 'duyệt' : 'từ chối';

    Modal.confirm({
      title: <Text strong style={{ fontSize: 16 }}>Xác nhận {label} yêu cầu Chợ - Phố</Text>,
      icon: isApprove ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      width: 450,
      centered: true,
      content: (
        <div style={{ marginTop: 12 }}>
          Bạn đang thực hiện {label} cho <Text strong style={{ color: isApprove ? '#52c41a' : '#ff4d4f' }}>{selectedRowKeys.length}</Text> yêu cầu đã chọn. Hành động này sẽ cập nhật dữ liệu vào bảng chính ngay lập tức.
        </div>
      ),
      okText: `Xác nhận ${label}`,
      cancelText: 'Hủy bỏ',
      onOk: async () => {
        setApproving(true);
        try {
          // Lấy username người duyệt từ localStorage
          let username = 'Manager';
          const userInfoStr = localStorage.getItem('user_info');
          if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            username = userInfo.username || 'Manager';
          }

          const res = await fetch('/api/khach-hang/cho-pho/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ids: selectedRowKeys,
              action,
              user_duyet: username
            }),
          });

          const json = await res.json();
          if (json.success) {
            // Cập nhật Cache cục bộ nếu là Duyệt
            if (isApprove) {
              try {
                const currentCache = await getStoreData<{ MA_KH: string, TRENDUONG_TRONGCHO: string }>('kh_cho_pho');
                if (currentCache && currentCache.length > 0) {
                  const approvedItems = data.filter(item => selectedRowKeys.includes(item.ID));
                  const newCache = currentCache.map(c => {
                    const approved = approvedItems.find(a => a.Ma_KH === c.MA_KH);
                    if (approved) {
                      return { ...c, TRENDUONG_TRONGCHO: approved.Gia_tri_moi };
                    }
                    return c;
                  });
                  await setStoreData('kh_cho_pho', newCache);
                }
              } catch (cacheErr) {
                console.error('Update local cache error:', cacheErr);
              }
            }

            notification.success({
              title: `Thực hiện ${label} thành công`,
              description: `Đã xử lý xong ${selectedRowKeys.length} yêu cầu.`,
              placement: 'bottomRight'
            });
            setSelectedRowKeys([]);
            await fetchData(); // Tải lại danh sách mới
          } else {
            message.error(json.error || `Lỗi khi thực hiện ${label}`);
          }
        } catch (e) {
          message.error('Lỗi kết nối Server');
        } finally {
          setApproving(false);
        }
      }
    });
  };

  // Hàm Xóa yêu cầu (Chỉ cho phép xóa khi Chờ duyệt)
  const handleDelete = async () => {
    const pendingIds = selectedRowKeys.filter(id => {
      const item = data.find(x => x.ID === id);
      return item?.Trang_thai_duyet === 'Chờ duyệt';
    });

    if (pendingIds.length === 0) {
      notification.warning({ title: 'Vui lòng chọn yêu cầu ở trạng thái "Chờ duyệt" để xóa' });
      return;
    }

    Modal.confirm({
      title: 'Xác nhận xóa bản ghi',
      icon: <ExclamationCircleOutlined />,
      content: `Bạn có chắc chắn muốn xóa vĩnh viễn ${pendingIds.length} yêu cầu này không? Hành động này không thể hoàn tác.`,
      okText: 'Xóa ngay',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/khach-hang/cho-pho/save', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: pendingIds })
          });
          const json = await res.json();
          if (json.success) {
            notification.success({ title: 'Đã xóa thành công!' });
            setSelectedRowKeys([]);
            fetchData();
          } else {
            notification.error({ title: 'Lỗi khi xóa dữ liệu', description: json.error });
          }
        } catch (err) {
          notification.error({ title: 'Lỗi kết nối máy chủ' });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (selectedKhuVuc && r.Khu_vuc !== selectedKhuVuc) return false;
      if (selectedNVBH && r.NVBH !== selectedNVBH) return false;
      if (selectedTrangThai && r.Trang_thai_duyet !== selectedTrangThai) return false;
      return true;
    });
  }, [data, selectedKhuVuc, selectedNVBH, selectedTrangThai]);

  const columns: ColumnsType<RecordType> = [
    { title: 'STT', key: 'stt', width: 45, align: 'center', render: (_, __, i) => i + 1 },
    {
      title: 'Khu vực', dataIndex: 'Khu_vuc', key: 'Khu_vuc', width: 90, align: 'center',
      render: v => <Tag color="blue" style={{ borderRadius: 4 }}>{v}</Tag>
    },
    {
      title: 'Khách hàng', key: 'kh', width: 220, align: 'left',
      render: (_, r) => (
        <Tooltip title={`${r.Ma_KH} - ${r.Ten_KH}`} mouseEnterDelay={0.5}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <Text strong style={{ color: '#1677ff', fontSize: 13, marginRight: 4 }}>{r.Ma_KH}</Text>
            <Text style={{ fontSize: 12 }}> - {r.Ten_KH}</Text>
          </div>
        </Tooltip>
      )
    },
    {
      title: 'Địa chỉ', dataIndex: 'Dia_chi', key: 'Dia_chi', width: 180, align: 'left',
      render: v => (
        <Tooltip title={v}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, color: '#666' }}>{v}</div>
        </Tooltip>
      )
    },
    {
      title: 'Thứ', dataIndex: 'Thu', key: 'Thu', width: 60, align: 'center',
      render: v => <Text strong style={{ color: '#eb2f96' }}>{v}</Text>
    },
    {
      title: 'Thay đổi (Cũ → Mới)', key: 'val', width: 200, align: 'center',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Tag color="default" style={{ textDecoration: 'line-through', opacity: 0.5, margin: 0 }}>{r.Gia_tri_cu || 'Trống'}</Tag>
          <Text type="secondary" style={{ fontSize: 10 }}>→</Text>
          <Tag color="purple" style={{ fontWeight: 'bold', margin: 0, border: '1px solid #d3adf7' }}>{r.Gia_tri_moi}</Tag>
        </div>
      )
    },
    {
      title: 'Người ĐK', key: 'req', width: 130, align: 'center',
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 12, color: '#595959' }}>{r.Nguoi_dang_ky}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(r.Ngay_dang_ky)}</Text>
        </div>
      )
    },
    { title: 'Trạng thái', dataIndex: 'Trang_thai_duyet', key: 'st', width: 100, align: 'center', render: v => <Tag color={trangThaiColors[v]} style={{ minWidth: 80, textAlign: 'center' }}>{v}</Tag> },
    {
      title: 'Xử lý', key: 'meta_duyet', width: 130, align: 'center',
      render: (_, r) => r.Ngay_duyet ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 12, color: '#262626' }}>{r.Nguoi_duyet}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(r.Ngay_duyet)}</Text>
        </div>
      ) : <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 12 }}>Chờ xử lý</Text>
    },
  ];

    return (
        <Flex vertical gap={12} style={{ height: '100%', overflow: 'hidden' }}>
            <Flex gap={12} align="end" style={{ paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ flex: 1, maxWidth: 200 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Khu vực</Text>
                    <Select placeholder="Tất cả" value={selectedKhuVuc} onChange={v => { setSelectedKhuVuc(v); setSelectedNVBH(undefined); }} allowClear showSearch options={cachedKhuVuc.map(v => ({ label: v, value: v }))} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1, maxWidth: 220 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>NVBH</Text>
                    <Select placeholder="Tất cả" value={selectedNVBH} onChange={setSelectedNVBH} allowClear showSearch options={cachedNVBH.filter(n => !selectedKhuVuc || n.TEN_KHUVUC === selectedKhuVuc).map(n => ({ label: n.MA_TEN_NVBH, value: n.MA_TEN_NVBH }))} style={{ width: '100%' }} />
                </div>
                <div style={{ width: 120 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Trạng thái</Text>
                    <Select placeholder="Tất cả" value={selectedTrangThai} onChange={setSelectedTrangThai} allowClear options={[{ label: 'Chờ duyệt', value: 'Chờ duyệt' }, { label: 'Đã duyệt', value: 'Đã duyệt' }, { label: 'Từ chối', value: 'Từ chối' }, { label: 'Tất cả', value: '' }]} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}></div>
                <Button icon={<ReloadOutlined />} onClick={() => fetchData(true)} loading={loading}>Tải lại</Button>
            </Flex>

      <Spin spinning={loading} classNames={{ root: "flex-1 overflow-hidden" }}>
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
            showTotal: (total, range) => <span>{range[0]}-{range[1]} / {total} yêu cầu</span>
          }}
        />
      </Spin>

            <Flex gap={8} style={{ marginTop: 12 }}>
                <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleDelete}
                    disabled={selectedRowKeys.length === 0}
                >
                    Xóa ({selectedRowKeys.length})
                </Button>
                <Button
                    danger
                    type="primary"
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleAction('Reject')}
                    disabled={selectedRowKeys.length === 0}
                    loading={approving}
                >
                    Từ chối ({selectedRowKeys.length})
                </Button>
                <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleAction('Approve')}
                    disabled={selectedRowKeys.length === 0}
                    loading={approving}
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                >
                    Duyệt ({selectedRowKeys.length})
                </Button>
            </Flex>
        </Flex>
  );
}
