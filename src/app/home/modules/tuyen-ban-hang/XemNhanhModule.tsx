"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { Select, Spin, Typography, Button } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import { useCachedData } from '../../../../hooks/useCachedData';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../../../constants';

const { Text } = Typography;

interface RawRecord {
  Mã_KH: string;
  Mã_Tên_NVBH: string;
  Khu_Vực: string;
  Thứ: string;
  Tần_Suất: string;
}

interface SummaryRecord {
  key: string;
  khuVuc: string;
  nvbh: string;
  tongKH: number;
  t2: number; t3: number; t4: number; t5: number; t6: number; t7: number; cn: number;
}

export default function XemNhanhModule({ ngayUpdate, setNgayUpdate }: { ngayUpdate: string, setNgayUpdate?: (d: string) => void }) {
  // Sử dụng lại cache kh_kpsds từ KPSDSModule
  const { data, loading, loadingText, forceReload } = useCachedData<RawRecord>({
    storeName: 'kh_kpsds',
    cacheKey: 'kh_kpsds_ngay_update',
    apiPath: '/api/khach-hang/kpsds',
    ngayUpdate,
    setNgayUpdate
  });

  const [selectedKhuVuc, setSelectedKhuVuc] = useState<string | undefined>();
  const [cachedKhuVuc, setCachedKhuVuc] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Load danh mục Khu vực từ Metadata dùng chung
  useEffect(() => {
    const loadCache = async () => {
      try {
        const { getCacheMeta } = await import('../../../../utils/indexedDB');
        const kv = await getCacheMeta('common_khuvuc');
        if (kv) setCachedKhuVuc(JSON.parse(kv));
      } catch (e) {
        console.error('Load filter cache error:', e);
      }
    };
    loadCache();
  }, []);

  // Tính toán bảng tổng hợp từ dữ liệu thô (Aggregation)
  const summaryData = useMemo(() => {
    const groups: Record<string, any> = {};

    data.forEach(r => {
      // Lọc theo Khu vực nếu người dùng chọn
      if (selectedKhuVuc && r.Khu_Vực !== selectedKhuVuc) return;

      // Logic đếm đặc biệt cho F2: Chỉ đếm nếu có chữ "v"
      const tanSuat = r.Tần_Suất || '';
      const isF2 = tanSuat.includes('F2');
      const hasV = tanSuat.toLowerCase().includes('v');
      
      if (isF2 && !hasV) return; // Bỏ qua nếu là F2 nhưng không có chữ "v"

      const key = `${r.Khu_Vực}_${r.Mã_Tên_NVBH}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          khuVuc: r.Khu_Vực,
          nvbh: r.Mã_Tên_NVBH,
          khSet: new Set(), // Dùng Set để đếm mã KH duy nhất
          t2: 0, t3: 0, t4: 0, t5: 0, t6: 0, t7: 0, cn: 0
        };
      }

      const g = groups[key];
      g.khSet.add(r.Mã_KH);

      // Đếm số lượng khách hàng theo Thứ
      const thu = r.Thứ || '';
      if (thu.includes('T2')) g.t2++;
      if (thu.includes('T3')) g.t3++;
      if (thu.includes('T4')) g.t4++;
      if (thu.includes('T5')) g.t5++;
      if (thu.includes('T6')) g.t6++;
      if (thu.includes('T7')) g.t7++;
      if (thu.includes('CN')) g.cn++;
    });

    // Chuyển Set thành con số cụ thể
    return Object.values(groups).map(g => ({
      ...g,
      tongKH: g.khSet.size
    })).sort((a, b) => a.khuVuc.localeCompare(b.khuVuc) || a.nvbh.localeCompare(b.nvbh));
  }, [data, selectedKhuVuc]);

  const renderCount = (v: number) => (
    <Text strong={v < 30} style={{ color: v < 30 ? '#cf1322' : 'inherit' }}>
      {v}
    </Text>
  );

  const getCellProps = (v: number) => ({
    style: {
      backgroundColor: v < 30 ? '#fff1f0' : undefined,
      transition: 'all 0.3s'
    }
  });

  const columns: ColumnsType<SummaryRecord> = [
    { title: 'STT', key: 'stt', width: 50, align: 'center', fixed: 'left', render: (_v, _r, index) => index + 1 },
    { title: 'Khu vực', dataIndex: 'khuVuc', key: 'khuVuc', width: 130, fixed: 'left', align: 'left' },
    { title: 'Mã - Tên NV', dataIndex: 'nvbh', key: 'nvbh', width: 250, fixed: 'left', align: 'left' },
    { 
      title: 'Tổng KH', 
      dataIndex: 'tongKH', 
      key: 'tongKH', 
      width: 100, 
      align: 'center', 
      onCell: (r) => getCellProps(r.tongKH),
      render: (v) => <Text strong style={{ color: v < 30 ? '#cf1322' : '#1677ff' }}>{v}</Text> 
    },
    { title: 'Thứ 2', dataIndex: 't2', key: 't2', width: 80, align: 'center', onCell: (r) => getCellProps(r.t2), render: renderCount },
    { title: 'Thứ 3', dataIndex: 't3', key: 't3', width: 80, align: 'center', onCell: (r) => getCellProps(r.t3), render: renderCount },
    { title: 'Thứ 4', dataIndex: 't4', key: 't4', width: 80, align: 'center', onCell: (r) => getCellProps(r.t4), render: renderCount },
    { title: 'Thứ 5', dataIndex: 't5', key: 't5', width: 80, align: 'center', onCell: (r) => getCellProps(r.t5), render: renderCount },
    { title: 'Thứ 6', dataIndex: 't6', key: 't6', width: 80, align: 'center', onCell: (r) => getCellProps(r.t6), render: renderCount },
    { title: 'Thứ 7', dataIndex: 't7', key: 't7', width: 80, align: 'center', onCell: (r) => getCellProps(r.t7), render: renderCount },
    { title: 'Chủ nhật', dataIndex: 'cn', key: 'cn', width: 100, align: 'center', onCell: (r) => getCellProps(r.cn), render: renderCount },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ width: 250 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Khu vực</div>
          <Select
            placeholder="Tất cả"
            value={selectedKhuVuc}
            onChange={setSelectedKhuVuc}
            allowClear
            showSearch
            options={cachedKhuVuc.map(v => ({ label: v, value: v }))}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1 }}></div>
        <Button icon={<ReloadOutlined />} onClick={forceReload} loading={loading}>Tải lại</Button>
      </div>

      {/* Bảng tổng hợp Pivot */}
      <Spin spinning={loading} description={loadingText}>
        <CustomTable
          columns={columns}
          dataSource={summaryData}
          rowKey="key"
          pagination={{
            pageSize,
            onChange: (_, size) => setPageSize(size),
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (total, range) => <span>{range[0]}-{range[1]} / {total} — Đang hiện: <b>{summaryData.length}</b> dòng</span>
          }}
          scroll={{ x: 1000, y: 'calc(100vh - 280px)' }}
        />
      </Spin>
    </div>
  );
}
