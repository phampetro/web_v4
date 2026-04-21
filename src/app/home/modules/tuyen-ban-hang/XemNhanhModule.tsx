"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { Select, Spin, Typography, Button, Tooltip } from 'antd';
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
    const days = ['t2', 't3', 't4', 't5', 't6', 't7', 'cn'];

    data.forEach(r => {
      if (selectedKhuVuc && r.Khu_Vực !== selectedKhuVuc) return;

      const tanSuat = r.Tần_Suất || '';
      const isF2 = tanSuat.includes('F2');
      const hasV = tanSuat.toLowerCase().includes('v');
      if (isF2 && !hasV) return;

      const key = `${r.Khu_Vực}_${r.Mã_Tên_NVBH}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          khuVuc: r.Khu_Vực,
          nvbh: r.Mã_Tên_NVBH,
          khSet: new Set(),
        };
        days.forEach(d => {
          groups[key][d] = { total: 0, details: {} as Record<string, number> };
        });
      }

      const g = groups[key];
      g.khSet.add(r.Mã_KH);

      const thuStr = r.Thứ || '';
      const dayMapping: Record<string, string> = { 'T2': 't2', 'T3': 't3', 'T4': 't4', 'T5': 't5', 'T6': 't6', 'T7': 't7', 'CN': 'cn' };

      Object.entries(dayMapping).forEach(([label, key]) => {
        if (thuStr.includes(label)) {
          g[key].total++;
          g[key].details[tanSuat] = (g[key].details[tanSuat] || 0) + 1;
        }
      });
    });

    return Object.values(groups).map(g => ({
      ...g,
      tongKH: g.khSet.size
    })).sort((a, b) => a.khuVuc.localeCompare(b.khuVuc) || a.nvbh.localeCompare(b.nvbh));
  }, [data, selectedKhuVuc]);

  const getCellProps = (val: any) => {
    const num = typeof val === 'object' ? val.total : val;
    if (num > 0 && num < 30) {
      return { style: { backgroundColor: '#fff1f0', fontWeight: 'bold' } };
    }
    return {};
  };

  const renderCount = (val: any) => {
    const total = val?.total || 0;
    if (total === 0) return <Text type="secondary">-</Text>;

    // Tạo nội dung cho Tooltip
    const tooltipContent = (
      <div style={{ padding: '4px' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.3)', marginBottom: '4px', paddingBottom: '2px', fontWeight: 'bold' }}>
          Chi tiết tần suất:
        </div>
        {Object.entries(val.details as Record<string, number>)
          .sort((a, b) => b[1] - a[1]) // Hiện số lượng nhiều lên trước
          .map(([ts, count]) => {
            // Loại bỏ chữ "v" hoặc " v" ở cuối chuỗi để hiển thị đẹp hơn
            const displayTs = ts.replace(/\s*v$/i, '').trim();
            return (
              <div key={ts} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <span>{displayTs}:</span>
                <span style={{ fontWeight: 'bold' }}>{count}</span>
              </div>
            );
          })}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', marginTop: '4px', paddingTop: '2px', textAlign: 'right' }}>
          Tổng: <b>{total}</b>
        </div>
      </div>
    );

    return (
      <Tooltip title={tooltipContent} color="#262626">
        <Text strong style={{ color: total < 30 ? '#cf1322' : '#0958d9', cursor: 'help' }}>
          {total}
        </Text>
      </Tooltip>
    );
  };

  const columns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, align: 'center', fixed: 'left', render: (_, __, i) => i + 1 },
    { title: 'Khu vực', dataIndex: 'khuVuc', key: 'khuVuc', width: 100, align: 'left', fixed: 'left' },
    { title: 'Mã - Tên NVBH', dataIndex: 'nvbh', key: 'nvbh', width: 220, align: 'left', fixed: 'left' },
    {
      title: 'Tổng KH',
      dataIndex: 'tongKH',
      key: 'tongKH',
      width: 90,
      align: 'center',
      render: (v) => <Text strong style={{ color: '#000' }}>{v}</Text>
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
          scroll={{ x: 1000, y: 550 }}
        />
      </Spin>
    </div>
  );
}
