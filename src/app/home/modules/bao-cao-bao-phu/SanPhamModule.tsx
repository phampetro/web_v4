"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Spin, Typography, Input, Button, Space, Row, Col, message, Modal, Flex, Select, Card, Empty, Checkbox } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import {
  RightOutlined,
  LeftOutlined,
  SaveOutlined,
  SearchOutlined,
  HolderOutlined,
  ReloadOutlined,
  DeleteOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import { getStoreData, setStoreData, getCacheMeta } from '../../../../utils/indexedDB';
import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../../../constants';

const { Title, Text } = Typography;

interface Product {
  MA_SPQD: string;
  TEN_SPQD: string;
  Username?: string;
  Thu_tu_sap_xep?: number;
}

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string;
}

const RowDnD = (props: RowProps) => {
  const { children, ...restProps } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    cursor: isDragging ? 'grabbing' : 'auto',
    ...(isDragging ? { position: 'relative', zIndex: 999, background: '#e6f4ff' } : {}),
  };

  return (
    <tr {...restProps} ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </tr>
  );
};

export default function SanPhamModule() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [loadingText, setLoadingText] = useState("Đang tải dữ liệu...");
  const [rightSearchText, setRightSearchText] = useState('');
  const [rightSelectedKeys, setRightSelectedKeys] = useState<React.Key[]>([]);

  // States cho bộ lọc báo cáo
  const [reportType, setReportType] = useState('khach_hang');
  const [filterAreas, setFilterAreas] = useState<string[]>([]);
  const [areaOptions, setAreaOptions] = useState<{ label: string, value: string }[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 1 } }));

  const fetchData = async (forceReload = false) => {
    setLoading(true);
    try {
      if (!forceReload) {
        const cachedAll = await getStoreData<Product>('config_all_products');
        const cachedUser = await getStoreData<Product>('config_user_products');
        if (cachedAll.length > 0) {
          setAllProducts(cachedAll);
          if (cachedUser.length > 0) setSelectedProducts(cachedUser.sort((a, b) => (a.Thu_tu_sap_xep || 0) - (b.Thu_tu_sap_xep || 0)));
          setLoading(false);
          return;
        }
      }
      const res = await fetch('/api/bao-cao-bao-phu/san-pham', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch' })
      });
      const json = await res.json();
      if (json.allProducts) {
        setAllProducts(json.allProducts);
        await setStoreData('config_all_products', json.allProducts);
      }
      if (json.userConfig) {
        const sorted = json.userConfig.sort((a: any, b: any) => (a.Thu_tu_sap_xep || 0) - (b.Thu_tu_sap_xep || 0));
        setSelectedProducts(sorted);
        await setStoreData('config_user_products', json.userConfig);
      }
    } catch { message.error('Lỗi tải dữ liệu'); } finally { setLoading(false); }
  };

  const loadFilterData = async () => {
    try {
      const kv = await getCacheMeta('common_khuvuc');
      if (kv) {
        const list: string[] = JSON.parse(kv);
        setAreaOptions(list.map(v => ({ label: v, value: v })));
      }
    } catch (e) {
      console.error('Error loading filter data:', e);
    }
  };

  useEffect(() => {
    fetchData();
    loadFilterData();
  }, []);

  const rightTableData = useMemo(() => {
    return selectedProducts.filter(p => (p.MA_SPQD.toLowerCase().includes(rightSearchText.toLowerCase()) || p.TEN_SPQD.toLowerCase().includes(rightSearchText.toLowerCase())));
  }, [selectedProducts, rightSearchText]);

  const updateSortOrders = (list: Product[]) => list.map((item, index) => ({ ...item, Thu_tu_sap_xep: index + 1 }));

  const handleSelectChange = (newValues: string[]) => {
    // Find what was added or removed
    const currentIds = selectedProducts.map(p => p.MA_SPQD);

    if (newValues.length > currentIds.length) {
      // Added
      const addedId = newValues.find(id => !currentIds.includes(id));
      const product = allProducts.find(p => p.MA_SPQD === addedId);
      if (product) {
        setSelectedProducts(updateSortOrders([...selectedProducts, product]));
        message.success(`Đã thêm: ${product.TEN_SPQD}`);
      }
    } else {
      // Removed
      const removedId = currentIds.find(id => !newValues.includes(id));
      if (removedId) {
        setSelectedProducts(updateSortOrders(selectedProducts.filter(p => p.MA_SPQD !== removedId)));
      }
    }
  };

  const removeProduct = (maSp: string) => {
    setSelectedProducts(updateSortOrders(selectedProducts.filter(p => p.MA_SPQD !== maSp)));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id !== over?.id) {
      setSelectedProducts((prev) => {
        const activeIndex = prev.findIndex((i) => i.MA_SPQD === active.id);
        const overIndex = prev.findIndex((i) => i.MA_SPQD === over?.id);
        return updateSortOrders(arrayMove(prev, activeIndex, overIndex));
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/bao-cao-bao-phu/san-pham', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: selectedProducts }) });
      const json = await res.json();
      if (json.success) {
        message.success('Lưu cấu hình thành công');
        await setStoreData('config_user_products', selectedProducts);
      } else message.error('Lỗi khi lưu: ' + json.error);
    } catch { message.error('Lỗi kết nối'); } finally { setSaving(false); }
  };

  const handleExportExcel = async () => {
    if (selectedProducts.length === 0) {
      message.warning('Vui lòng chọn ít nhất một sản phẩm');
      return;
    }
    setLoading(true);
    setLoadingText("Đang khởi tạo báo cáo...");
    try {
      const ngayUpdate = await getCacheMeta('common_ngay_update');

      const res = await fetch('/api/bao-cao-bao-phu/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: selectedProducts,
          areas: filterAreas.length > 0 ? filterAreas : areaOptions.map(o => o.value),
          reportType: reportType,
          ngayUpdate: ngayUpdate
        })
      });

      if (!res.ok) throw new Error('Lỗi xuất file');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const reportName = reportType === 'khach_hang' ? 'Khach_hang' : (reportType === 'tuyen' ? 'Theo_tuyen' : 'Theo_khu_vuc');
      a.download = `Bao_cao_bao_phu_${reportName}_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('Xuất báo cáo thành công');
    } catch (err: any) {
      message.error('Lỗi khi xuất báo cáo: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingText("Đang tải dữ liệu...");
    }
  };

  const rightColumns = [
    { title: '', key: 'drag', width: 40, align: 'center' as const, render: () => <Flex justify="center" align="center" style={{ height: 32 }}><HolderOutlined style={{ cursor: 'grab', color: '#8c8c8c' }} /></Flex> },
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'Mã SP', dataIndex: 'MA_SPQD', width: 130, align: 'left' as const },
    { title: 'Tên Sản Phẩm', dataIndex: 'TEN_SPQD', align: 'left' as const },
    {
      title: 'Thao tác',
      key: 'action',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: Product) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            removeProduct(record.MA_SPQD);
          }}
        />
      )
    },
  ];

  const searchOptions = useMemo(() => {
    const selectedIds = new Set(selectedProducts.map(p => p.MA_SPQD));
    return allProducts.map(p => ({
      value: p.MA_SPQD,
      label: (
        <Flex gap={8} align="center">
          <Checkbox checked={selectedIds.has(p.MA_SPQD)} />
          <span>{p.MA_SPQD} - {p.TEN_SPQD}</span>
        </Flex>
      ),
      search: `${p.MA_SPQD} ${p.TEN_SPQD}`.toLowerCase()
    }));
  }, [allProducts, selectedProducts]);

  return (
    <Flex vertical gap={12} style={{ height: '100%', overflow: 'hidden', paddingTop: 12 }}>
      <Spin spinning={loading} description={loadingText}>
        <Row gutter={24} style={{ flex: 1 }}>
          <Col span={12} style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #f0f0f0', paddingRight: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0 }}>Sản phẩm đã chọn ({selectedProducts.length})</Title>
                <Button icon={<ReloadOutlined />} onClick={() => fetchData(true)} loading={loading}>Tải lại</Button>
              </Flex>
              <Select
                mode="multiple"
                showSearch
                style={{ width: '100%' }}
                placeholder="Tìm để thêm hoặc bớt sản phẩm..."
                optionFilterProp="children"
                value={selectedProducts.map(p => p.MA_SPQD)}
                onChange={handleSelectChange}
                filterOption={(input, option) => (option?.search ?? '').includes(input.toLowerCase())}
                options={searchOptions}
                allowClear
                suffixIcon={<SearchOutlined />}
                maxTagCount={0}
                maxTagPlaceholder={(omittedValues) => `Đã chọn ${selectedProducts.length} sản phẩm`}
                styles={{ popup: { root: { minWidth: 350 } } }}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
                <SortableContext items={selectedProducts.map((i) => i.MA_SPQD)} strategy={verticalListSortingStrategy}>
                  <CustomTable
                    className="compact-table"
                    components={{ body: { row: RowDnD } }}
                    dataSource={rightTableData}
                    columns={rightColumns}
                    rowKey="MA_SPQD"
                    pagination={false}
                    virtual={false}
                    scroll={{ y: 550 }}
                    size="small"
                  />
                </SortableContext>
              </DndContext>
              <Flex justify="start" style={{ marginTop: 12 }}>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} disabled={loading}>Lưu</Button>
              </Flex>
            </div>
          </Col>

          <Col span={12}>
            <Card title="Bộ lọc & Xuất báo cáo" variant="borderless" style={{ background: '#fafafa', height: '100%', borderRadius: 12 }}>
              <Flex vertical gap={24} style={{ paddingTop: 10 }}>
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>1. Chọn loại báo cáo</Text>
                  <Select
                    style={{ width: '100%' }}
                    value={reportType}
                    onChange={setReportType}
                    options={[
                      { label: 'Bao phủ theo khách hàng', value: 'khach_hang' },
                      { label: 'Bao phủ theo tuyến', value: 'tuyen' },
                      { label: 'Bao phủ theo khu vực', value: 'khu_vuc' },
                    ]}
                  />
                </div>

                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>2. Lọc theo Khu vực</Text>
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    style={{ width: '100%' }}
                    placeholder="Tất cả khu vực"
                    value={filterAreas}
                    onChange={setFilterAreas}
                    options={areaOptions}
                    maxTagCount="responsive"
                  />
                </div>


                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<FileExcelOutlined />}
                    onClick={handleExportExcel}
                    loading={loading}
                    style={{ height: 50, width: '100%', fontSize: 16, background: '#1d893d', borderRadius: 8 }}
                  >
                    XUẤT BÁO CÁO
                  </Button>
                </div>
              </Flex>
            </Card>
          </Col>
        </Row>
      </Spin>
    </Flex>
  );
}

// Thêm CSS để làm bảng cực kỳ gọn
const tableStyle = `
  .compact-table .ant-table-tbody > tr > td,
  .compact-table .ant-table-thead > tr > th {
    padding: 0 8px !important;
    height: 32px !important;
    line-height: 32px !important;
    vertical-align: middle !important;
  }
  .compact-table .ant-table-cell {
    padding: 0 8px !important;
    vertical-align: middle !important;
    line-height: 32px !important;
  }
  /* Fix icon and button alignment */
  .compact-table .ant-btn-text.ant-btn-icon-only {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 32px !important;
  }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = tableStyle;
  document.head.appendChild(style);
}
