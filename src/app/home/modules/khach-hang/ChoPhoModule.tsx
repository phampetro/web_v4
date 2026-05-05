import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Spin, Tag, Select, Button, Modal, message, Typography, Tooltip, Flex } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import { ArrowRightOutlined, CheckCircleOutlined, DownloadOutlined, ReloadOutlined, SendOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useCachedData } from '../../../../hooks/useCachedData';
import { THU_OPTIONS, THU_LIST, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../../../constants';
import { getStoreData, setStoreData, getCacheMeta, setCacheMeta } from '../../../../utils/indexedDB';

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

const STORE_NAME_BASE = 'kh_kpsds';
const CACHE_KEY_BASE = 'kh_kpsds_ngay_update';

const STORE_NAME_CP = 'kh_cho_pho';
const CACHE_KEY_CP = 'kh_cho_pho_ngay_update';

export default function ChoPhoModule({ ngayUpdate, setNgayUpdate }: { ngayUpdate: string, setNgayUpdate?: (d: string) => void }) {
  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
  const [selectedNVBH, setSelectedNVBH] = useState<string | undefined>();
  // 1. Hook lấy dữ liệu KPSDS cơ bản
  const {
    data: baseData,
    loading: loadingBase,
    reloadData: reloadBase,
    forceReload: forceReloadBase
  } = useCachedData<KHRecord>({
    storeName: STORE_NAME_BASE,
    cacheKey: CACHE_KEY_BASE,
    apiPath: '/api/khach-hang/kpsds',
    ngayUpdate,
    setNgayUpdate
  });

  // 2. State quản lý dữ liệu Chợ - Phố riêng
  const [choPhoMap, setChoPhoMap] = useState<Record<string, string>>({});
  const [loadingCP, setLoadingCP] = useState(false);
  const [pendingInDB, setPendingInDB] = useState<Record<string, { val: string, status: string }>>({}); // { MaKH: { val, status } }

  // 3. Bộ lọc
  const [selectedKH, setSelectedKH] = useState<string | undefined>();
  const dayIdx = new Date().getDay(); // 0=CN, 1=T2...
  const todayThu = THU_LIST[(dayIdx + 6) % 7]; // Chuyển đổi để khớp với mảng T2 -> CN
  const [selectedThu, setSelectedThu] = useState<string[]>([todayThu]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [cachedKhuVuc, setCachedKhuVuc] = useState<string[]>([]);
  const [cachedNVBH, setCachedNVBH] = useState<{ MA_TEN_NVBH: string, TEN_KHUVUC: string }[]>([]);

  // Logic tải dữ liệu Chợ - Phố (Hỗ trợ Cache & POST)
  const fetchChoPhoData = useCallback(async (isForce = false) => {
    setLoadingCP(true);
    try {
      // 1. Lấy danh sách khu vực từ IndexedDB
      let kvList: string[] = [];
      const kvStr = await getCacheMeta('common_khuvuc');
      if (kvStr) {
        kvList = JSON.parse(kvStr);
      }

      if (kvList.length === 0) {
        setLoadingCP(false);
        return false;
      }

      const username = JSON.parse(localStorage.getItem('user_info') || '{}').username || '';

      // 2. Kiểm tra phiên bản dữ liệu
      let shouldFetch = isForce;
      let serverNgay = '';

      if (!isForce) {
        const resCheck = await fetch('/api/khach-hang/cho-pho', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, checkOnly: true })
        });
        const checkJson = await resCheck.json();
        serverNgay = checkJson.ngayUpdate;
        const localNgay = await getCacheMeta(CACHE_KEY_CP);

        if (localNgay !== serverNgay || !serverNgay) {
          shouldFetch = true;
        }
      }

      // 3. Xử lý lấy dữ liệu (Từ Cache hoặc API)
      if (!shouldFetch) {
        const cached = await getStoreData<{ MA_KH: string, TRENDUONG_TRONGCHO: string }>(STORE_NAME_CP);
        if (cached.length > 0) {
          const map: Record<string, string> = {};
          cached.forEach(i => map[i.MA_KH] = i.TRENDUONG_TRONGCHO);
          setChoPhoMap(map);
          setLoadingCP(false);
          return false; // Không tải mới
        }
        shouldFetch = true;
      }

      if (shouldFetch) {
        const resData = await fetch('/api/khach-hang/cho-pho', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, khuVucList: kvList })
        });
        const dataJson = await resData.json();

        if (dataJson.data) {
          const map: Record<string, string> = {};
          dataJson.data.forEach((i: any) => {
            const key = (i.MA_KH || i.Ma_KH || i.ma_kh || '').toString().trim();
            if (key) map[key] = i.TRENDUONG_TRONGCHO;
          });
          setChoPhoMap(map);

          await setStoreData(STORE_NAME_CP, dataJson.data);
          if (dataJson.ngayUpdate || serverNgay) {
            await setCacheMeta(CACHE_KEY_CP, dataJson.ngayUpdate || serverNgay);
          }
          return true; // Có tải mới
        }
      }
      return false;
    } catch (err) {
      console.error('Fetch ChoPho error:', err);
      const cached = await getStoreData<{ MA_KH: string, Ma_KH?: string, ma_kh?: string, TRENDUONG_TRONGCHO: string }>(STORE_NAME_CP);
      const map: Record<string, string> = {};
      cached.forEach((i: any) => {
        const key = (i.MA_KH || i.Ma_KH || i.ma_kh || '').toString().trim();
        if (key) map[key] = i.TRENDUONG_TRONGCHO;
      });
      setChoPhoMap(map);
      return false;
    } finally {
      setLoadingCP(false);
    }
  }, []);

  // Lấy danh sách các Mã KH đang chờ duyệt hoặc vừa duyệt từ DB để đè lên Cache
  const fetchPendingInDB = useCallback(async () => {
    try {
      const localNgayCP = await getCacheMeta(CACHE_KEY_CP);
      const userInfoStr = localStorage.getItem('user_info');
      if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          const username = userInfo.username || '';
          const res = await fetch(`/api/khach-hang/cho-pho/pending`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ since: localNgayCP, username: username })
          });
          const json = await res.json();
          if (Array.isArray(json)) {
            const map: Record<string, { val: string, status: string }> = {};
            json.forEach((item: any) => {
              const key = (item.Ma_KH || '').toString().trim();
              if (key) map[key] = { val: item.Gia_tri_moi, status: item.Trang_thai_duyet };
            });
            setPendingInDB(map);
          }
      }
    } catch (e) {
      console.error('Fetch pending error:', e);
    }
  }, []);

  useEffect(() => {
    fetchChoPhoData();
    fetchPendingInDB();
  }, [fetchChoPhoData, fetchPendingInDB]);

  // Nút Tải lại hợp nhất (Chế độ kiểm tra thông minh)
  const handleReload = async () => {
    try {
      const [resBase, resCP] = await Promise.all([
        reloadBase(),           // Trả về { updated: boolean }
        fetchChoPhoData(false), // Trả về boolean
        fetchPendingInDB()      // Overlay luôn được cập nhật
      ]);

      const hasUpdate = resBase?.updated || resCP;

      if (hasUpdate) {
        message.success({ content: 'Đã tải mới dữ liệu thành công!' });
      } else {
        message.success({ content: 'Dữ liệu đang là mới nhất.', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} /> });
      }
    } catch (err) {
      message.error({ content: 'Lỗi khi đồng bộ dữ liệu', key: 'reload' });
    }
  };

  // Hàm Gửi yêu cầu thay đổi
  const handleSubmit = async () => {
    const selectedRows = filteredData.filter(r => selectedRowKeys.includes(r.Mã_KH));
    const requests = selectedRows.map(r => ({
      maKH: r.Mã_KH,
      tenKH: r.Tên_KH,
      khuVuc: r.Khu_Vực,
      nvbh: r.Mã_Tên_NVBH,
      diaChi: r.Địa_Chỉ,
      thu: r.Thứ,
      oldVal: choPhoMap[r.Mã_KH] || '',
      newVal: pendingChanges[r.Mã_KH] || choPhoMap[r.Mã_KH] || ''
    }));

    if (requests.length === 0) {
      message.warning('Vui lòng chọn khách hàng và thay đổi giá trị trước khi gửi');
      return;
    }

    Modal.confirm({
      title: 'Xác nhận gửi yêu cầu Chợ - Phố',
      width: 500,
      centered: true,
      content: (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>Bạn đang gửi đăng ký cho <b>{requests.length}</b> khách hàng:</div>
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px' }}>
            {requests.map(req => (
              <div key={req.maKH} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #fafafa', paddingBottom: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13 }}><b>{req.maKH}</b> - {req.tenKH}</span>
                  <span style={{ fontSize: 11, color: '#8c8c8c' }}>{req.oldVal || 'Trống'} <ArrowRightOutlined style={{ fontSize: 10 }} /> <b style={{ color: '#722ed1' }}>{req.newVal}</b></span>
                </div>
                <Tag color="green" style={{ fontSize: 10, borderRadius: 4 }}>Đăng ký mới</Tag>
              </div>
            ))}
          </div>
        </div>
      ),
      okText: 'Xác nhận gửi ngay',
      cancelText: 'Hủy',
      onOk: async () => {
        setSaving(true);
        try {
          const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
          const res = await fetch('/api/khach-hang/cho-pho/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests,
              nguoi_dang_ky: userInfo.username
            })
          });
          const json = await res.json();
          if (json.success) {
            message.success(`Đã gửi thành công ${json.count} yêu cầu!`);
            setSelectedRowKeys([]);
            setPendingChanges({});
            fetchPendingInDB(); // Cập nhật lại danh sách khóa dòng ngay lập tức
          } else {
            message.error(json.error || 'Lỗi khi gửi dữ liệu');
          }
        } catch (err) {
          message.error('Lỗi kết nối máy chủ');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const columns: ColumnsType<KHRecord> = [
    { title: 'STT', key: 'stt', width: 45, align: 'center', render: (_v, _r, index) => index + 1 },
    { title: 'NVBH', dataIndex: 'Mã_Tên_NVBH', key: 'Mã_Tên_NVBH', width: 180, align: 'left' },
    {
      title: 'Khách hàng',
      key: 'khach_hang',
      width: 200,
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
    {
      title: 'Phố - Chợ',
      key: 'cho_pho',
      width: 160,
      align: 'center',
      render: (_, r) => {
        const dbStatus = pendingInDB[r.Mã_KH];

        // 1. Trường hợp Đang chờ duyệt -> Hiện nhãn khóa
        if (dbStatus && dbStatus.status === 'Chờ duyệt') {
          return (
            <Tooltip title={`Chờ duyệt: ${dbStatus.val}`}>
              <Tag 
                color="orange" 
                icon={<ClockCircleOutlined />}
                style={{ margin: 0, padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}
              >
                Chờ duyệt
              </Tag>
            </Tooltip>
          );
        }

        // 2. Trường hợp Đã duyệt (trong ngày) -> Hiện giá trị mới đè lên cache
        if (dbStatus && dbStatus.status === 'Đã duyệt') {
          return (
            <Tooltip title={`Đã duyệt: ${dbStatus.val}`}>
              <Tag 
                color="green" 
                icon={<CheckCircleOutlined />}
                style={{ margin: 0, padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}
              >
                Đã duyệt
              </Tag>
            </Tooltip>
          );
        }

        // 3. Trường hợp bình thường (lấy từ cache hoặc thay đổi chưa gửi)
        const maKH = r.Mã_KH.trim();
        const currentVal = pendingChanges[maKH] !== undefined ? pendingChanges[maKH] : (choPhoMap[maKH] || '');

        return (
          <Select
            value={currentVal || undefined}
            placeholder="Chọn..."
            style={{ width: '100%' }}
            size="small"
            onChange={(val) => {
              const maKH = r.Mã_KH.trim();
              setPendingChanges(prev => ({ ...prev, [maKH]: val }));
              const originalVal = choPhoMap[maKH] || '';
              if (val !== originalVal) {
                setSelectedRowKeys(prev => prev.includes(maKH) ? prev : [...prev, maKH]);
              } else {
                setSelectedRowKeys(prev => prev.filter(k => k !== maKH));
              }
            }}
            options={[
              { label: 'Trong Chợ', value: 'Trong Chợ' },
              { label: 'Trên Đường', value: 'Trên Đường' },
            ]}
            status={(pendingChanges[r.Mã_KH] !== undefined && pendingChanges[r.Mã_KH] !== (choPhoMap[r.Mã_KH] || '')) ? 'warning' : undefined}
          />
        );
      }
    },
    { title: 'Địa chỉ', dataIndex: 'Địa_Chỉ', key: 'Địa_Chỉ', width: 220, align: 'left' },
    { title: 'Thứ', dataIndex: 'Thứ', key: 'Thứ', width: 50, align: 'center' },
    { title: 'Khu vực', dataIndex: 'Khu_Vực', key: 'Khu_Vực', width: 80, align: 'center' },
  ];

  const khuVucOptions = useMemo(() => {
    const list = cachedKhuVuc.length > 0 ? cachedKhuVuc : [...new Set(baseData.map((r) => r.Khu_Vực).filter(Boolean))].sort();
    return list.map((v) => ({ label: v, value: v }));
  }, [baseData, cachedKhuVuc]);

  const nvbhOptions = useMemo(() => {
    if (cachedNVBH.length > 0) {
      let filtered = cachedNVBH;
      if (selectedKhuVuc) filtered = cachedNVBH.filter(n => n.TEN_KHUVUC === selectedKhuVuc);
      return filtered.map(n => ({ label: n.MA_TEN_NVBH, value: n.MA_TEN_NVBH }));
    }
    let list = selectedKhuVuc ? [...new Set(baseData.filter(r => r.Khu_Vực === selectedKhuVuc).map(r => r.Mã_Tên_NVBH).filter(Boolean))].sort() : [...new Set(baseData.map(r => r.Mã_Tên_NVBH).filter(Boolean))].sort();
    return list.map((v) => ({ label: v, value: v }));
  }, [baseData, selectedKhuVuc, cachedNVBH]);

  const khOptions = useMemo(() => {
    let filtered = baseData;
    if (selectedKhuVuc) filtered = filtered.filter((r) => r.Khu_Vực === selectedKhuVuc);
    if (selectedNVBH) filtered = filtered.filter((r) => r.Mã_Tên_NVBH === selectedNVBH);
    const uniqueMap = new Map();
    filtered.forEach(r => {
      if (!uniqueMap.has(r.Mã_KH)) uniqueMap.set(r.Mã_KH, { label: `${r.Mã_KH} - ${r.Tên_KH}`, value: r.Mã_KH });
    });
    return Array.from(uniqueMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [baseData, selectedKhuVuc, selectedNVBH]);

  const filteredData = useMemo(() => {
    return baseData.filter((r) => {
      if (selectedKhuVuc && r.Khu_Vực !== selectedKhuVuc) return false;
      if (selectedNVBH && r.Mã_Tên_NVBH !== selectedNVBH) return false;
      if (selectedKH && r.Mã_KH !== selectedKH) return false;
      if (selectedThu.length > 0 && !selectedThu.some((t) => r.Thứ.includes(t))) return false;
      return true;
    });
  }, [baseData, selectedKhuVuc, selectedNVBH, selectedKH, selectedThu]);

  const exportExcel = async (rows: KHRecord[]) => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Danh sách KH Chợ Phố');
      sheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Khu vực', key: 'khu_vuc', width: 15 },
        { header: 'NVBH', key: 'nvbh', width: 30 },
        { header: 'Mã KH', key: 'ma_kh', width: 15 },
        { header: 'Tên KH', key: 'ten_kh', width: 35 },
        { header: 'Phố - Chợ', key: 'cho_pho', width: 20 },
        { header: 'Địa chỉ', key: 'dc', width: 50 },
      ];
      rows.forEach((r, idx) => {
        sheet.addRow({
          stt: idx + 1,
          khu_vuc: r.Khu_Vực,
          nvbh: r.Mã_Tên_NVBH,
          ma_kh: r.Mã_KH,
          cho_pho: choPhoMap[r.Mã_KH] || '-',
          dc: r.Địa_Chỉ,
          thu: r.Thứ,
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `KH_ChoPho_${new Date().getTime()}.xlsx`);
    } catch (e) { message.error('Lỗi xuất Excel'); } finally { setExporting(false); }
  };

  const isLoading = loadingBase || loadingCP;

  return (
    <Flex vertical gap={12} style={{ height: '100%', overflow: 'hidden' }}>
      <Flex gap={12} align="end" style={{ paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Khu vực</Text>
          <Select placeholder="Tất cả" value={selectedKhuVuc} onChange={v => { setSelectedKhuVuc(v); setSelectedNVBH(undefined); setSelectedKH(undefined); }} allowClear showSearch options={khuVucOptions} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1.2, minWidth: 150 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>NVBH</Text>
          <Select placeholder="Tất cả" value={selectedNVBH} onChange={v => { setSelectedNVBH(v); setSelectedKH(undefined); }} allowClear showSearch options={nvbhOptions} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 2, minWidth: 250 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Mã - Tên KH</Text>
          <Select placeholder="Tìm kiếm..." value={selectedKH} onChange={setSelectedKH} allowClear showSearch options={khOptions} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 0.8, minWidth: 100 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Thứ</Text>
          <Select mode="multiple" placeholder="Tất cả" value={selectedThu} onChange={setSelectedThu} allowClear options={THU_OPTIONS} style={{ width: '100%' }} maxTagCount="responsive" />
        </div>

        <Button icon={<ReloadOutlined />} onClick={handleReload} loading={isLoading}>Tải lại</Button>
      </Flex>

      <Spin spinning={isLoading}>
        <CustomTable
          columns={columns}
          dataSource={filteredData}
          rowKey={(r) => r.Mã_KH}
          rowSelection={{
            selectedRowKeys,
            getCheckboxProps: (r) => {
              const dbStatus = pendingInDB[r.Mã_KH];
              const isLocked = !!dbStatus;
              return {
                disabled: true, // Luôn disable để không cho tick thủ công
                style: { pointerEvents: 'none' }
              };
            },
            hideSelectAll: true, // Ẩn nút chọn tất cả
          }}
          onRow={(r) => ({
            style: { cursor: pendingInDB[r.Mã_KH] ? 'default' : 'pointer' }
          })}
          pagination={{
            pageSize,
            onChange: (_, size) => setPageSize(size),
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (total) => <span>Hiển thị: <b>{filteredData.length}</b> / {total} KH</span>
          }}
        />
      </Spin>

      <Flex gap={8} style={{ marginTop: 12 }}>
        <Button icon={<DownloadOutlined />} onClick={() => exportExcel(filteredData)} disabled={filteredData.length === 0} loading={exporting}>Xuất Excel</Button>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={saving}
          disabled={selectedRowKeys.length === 0}
          style={{
            backgroundColor: selectedRowKeys.length > 0 ? '#722ed1' : '#f5f5f5',
            borderColor: selectedRowKeys.length > 0 ? '#722ed1' : '#d9d9d9',
            color: selectedRowKeys.length > 0 ? '#fff' : 'rgba(0, 0, 0, 0.25)'
          }}
        >
          Gửi yêu cầu {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
        </Button>
      </Flex>
    </Flex>
  );
}
