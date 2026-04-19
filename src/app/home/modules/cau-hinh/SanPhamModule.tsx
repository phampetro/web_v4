"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Spin, Typography, Input, Button, Space, Row, Col, message, Modal } from 'antd';
import CustomTable from '../../../../components/CustomTable';
import {
  RightOutlined,
  LeftOutlined,
  SaveOutlined,
  SearchOutlined,
  HolderOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { getStoreData, setStoreData } from '../../../../utils/indexedDB';
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

  return <tr {...props} ref={setNodeRef} style={style} {...attributes} {...listeners} />;
};

export default function SanPhamModule() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [loadingText, setLoadingText] = useState("Đang tải dữ liệu...");
   const [searchText, setSearchText] = useState('');
  const [rightSearchText, setRightSearchText] = useState('');
  const [leftSelectedKeys, setLeftSelectedKeys] = useState<React.Key[]>([]);
  const [rightSelectedKeys, setRightSelectedKeys] = useState<React.Key[]>([]);

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
      const res = await fetch('/api/cau-hinh/san-pham');
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

  useEffect(() => { fetchData(); }, []);

  const leftTableData = useMemo(() => {
    const selectedIds = new Set(selectedProducts.map(p => p.MA_SPQD));
    return allProducts.filter(p => !selectedIds.has(p.MA_SPQD) && (p.MA_SPQD.toLowerCase().includes(searchText.toLowerCase()) || p.TEN_SPQD.toLowerCase().includes(searchText.toLowerCase())));
  }, [allProducts, selectedProducts, searchText]);

  const rightTableData = useMemo(() => {
    return selectedProducts.filter(p => (p.MA_SPQD.toLowerCase().includes(rightSearchText.toLowerCase()) || p.TEN_SPQD.toLowerCase().includes(rightSearchText.toLowerCase())));
  }, [selectedProducts, rightSearchText]);

  const updateSortOrders = (list: Product[]) => list.map((item, index) => ({ ...item, Thu_tu_sap_xep: index + 1 }));

  const moveRight = () => {
    const itemsToAdd = leftTableData.filter(p => leftSelectedKeys.includes(p.MA_SPQD));
    setSelectedProducts(updateSortOrders([...selectedProducts, ...itemsToAdd]));
    setLeftSelectedKeys([]);
  };

  const moveLeft = () => {
    setSelectedProducts(updateSortOrders(selectedProducts.filter(p => !rightSelectedKeys.includes(p.MA_SPQD))));
    setRightSelectedKeys([]);
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
      const res = await fetch('/api/cau-hinh/san-pham', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: selectedProducts }) });
      const json = await res.json();
      if (json.success) {
        message.success('Lưu cấu hình thành công');
        await setStoreData('config_user_products', selectedProducts);
      } else message.error('Lỗi khi lưu: ' + json.error);
    } catch { message.error('Lỗi kết nối'); } finally { setSaving(false); }
  };

  const leftColumns = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'Mã SP', dataIndex: 'MA_SPQD', width: 130, align: 'left' as const },
    { title: 'Tên Sản Phẩm', dataIndex: 'TEN_SPQD', align: 'left' as const },
  ];

  const rightColumns = [
    { title: '', key: 'drag', width: 40, align: 'center' as const, render: () => <HolderOutlined style={{ cursor: 'grab', color: '#8c8c8c' }} /> },
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'Mã SP', dataIndex: 'MA_SPQD', width: 130, align: 'left' as const },
    { title: 'Tên Sản Phẩm', dataIndex: 'TEN_SPQD', align: 'left' as const },
    { title: 'Tài khoản', dataIndex: 'Username', width: 120, align: 'left' as const, render: (v: string) => v || '-' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Space orientation="vertical" size={0}><Title level={4} style={{ margin: 0 }}>Cấu hình sản phẩm bao phủ</Title><Text type="secondary" style={{ fontSize: 13 }}>Kéo thả để sắp xếp thứ tự hiển thị ưu tiên</Text></Space>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} disabled={loading}>Lưu cấu hình</Button>
      </div>
      <Spin spinning={loading} description={loadingText}>
        <Row gutter={16} style={{ flex: 1 }}>
          <Col span={10} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ marginBottom: 12 }}><Input placeholder="Tìm kiếm..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear /></div>
            <CustomTable dataSource={leftTableData} columns={leftColumns} rowKey="MA_SPQD" pagination={{ pageSize: 100, pageSizeOptions: PAGE_SIZE_OPTIONS, showSizeChanger: true }} rowSelection={{ selectedRowKeys: leftSelectedKeys, onChange: setLeftSelectedKeys }} onRow={(r) => ({ onClick: () => setLeftSelectedKeys(p => p.includes(r.MA_SPQD) ? p.filter(k => k !== r.MA_SPQD) : [...p, r.MA_SPQD]), style: { cursor: 'pointer' } })} />
          </Col>
          <Col span={1} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <Button icon={<RightOutlined />} onClick={moveRight} disabled={leftSelectedKeys.length === 0} type="primary" />
            <Button icon={<LeftOutlined />} onClick={moveLeft} disabled={rightSelectedKeys.length === 0} />
          </Col>
          <Col span={13} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Danh sách đã chọn ({selectedProducts.length})</Text>
              <Input placeholder="Lọc danh sách đã chọn..." prefix={<SearchOutlined />} value={rightSearchText} onChange={e => setRightSearchText(e.target.value)} allowClear style={{ width: 220 }} />
            </div>
            <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
              <SortableContext items={selectedProducts.map((i) => i.MA_SPQD)} strategy={verticalListSortingStrategy}>
                <CustomTable components={{ body: { row: RowDnD } }} dataSource={rightTableData} columns={rightColumns} rowKey="MA_SPQD" pagination={false} rowSelection={{ selectedRowKeys: rightSelectedKeys, onChange: setRightSelectedKeys }} onRow={(r) => ({ onClick: () => setRightSelectedKeys(p => p.includes(r.MA_SPQD) ? p.filter(k => k !== r.MA_SPQD) : [...p, r.MA_SPQD]), style: { cursor: 'pointer' } })} />
              </SortableContext>
            </DndContext>
          </Col>
        </Row>
      </Spin>
      <div style={{ marginTop: 12 }}><Button icon={<ReloadOutlined />} onClick={() => fetchData(true)} loading={loading}>Tải lại</Button></div>
    </div>
  );
}
