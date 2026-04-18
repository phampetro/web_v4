"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Spin, Typography, Input, Button, Space, Row, Col, message, Tooltip } from 'antd';
import CustomTable from '../../../components/CustomTable';
import {
  RightOutlined,
  LeftOutlined,
  SaveOutlined,
  SearchOutlined,
  HolderOutlined
} from '@ant-design/icons';
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

const { Title, Text } = Typography;

interface Product {
  MA_SPQD: string;
  TEN_SPQD: string;
  Thu_tu_sap_xep?: number;
}

interface Props {
  ngayUpdate: string;
  setNgayUpdate: (d: string) => void;
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

export default function CauHinhSanPhamPage({ ngayUpdate, setNgayUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

  const [searchText, setSearchText] = useState('');
  const [leftSelectedKeys, setLeftSelectedKeys] = useState<React.Key[]>([]);
  const [rightSelectedKeys, setRightSelectedKeys] = useState<React.Key[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1,
      },
    }),
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config-products');
      const json = await res.json();
      if (json.allProducts) setAllProducts(json.allProducts);
      if (json.userConfig) {
        // Đảm bảo có STT khi load
        const sorted = json.userConfig.sort((a: any, b: any) => (a.Thu_tu_sap_xep || 0) - (b.Thu_tu_sap_xep || 0));
        setSelectedProducts(sorted);
      }
    } catch (error) {
      message.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const leftTableData = useMemo(() => {
    const selectedIds = new Set(selectedProducts.map(p => p.MA_SPQD));
    return allProducts.filter(p => {
      const isNotSelected = !selectedIds.has(p.MA_SPQD);
      const matchesSearch = p.MA_SPQD.toLowerCase().includes(searchText.toLowerCase()) ||
        p.TEN_SPQD.toLowerCase().includes(searchText.toLowerCase());
      return isNotSelected && matchesSearch;
    });
  }, [allProducts, selectedProducts, searchText]);

  const updateSortOrders = (list: Product[]) => {
    return list.map((item, index) => ({
      ...item,
      Thu_tu_sap_xep: index + 1
    }));
  };

  const moveRight = () => {
    const itemsToAdd = leftTableData.filter(p => leftSelectedKeys.includes(p.MA_SPQD));
    const newList = updateSortOrders([...selectedProducts, ...itemsToAdd]);
    setSelectedProducts(newList);
    setLeftSelectedKeys([]);
  };

  const moveLeft = () => {
    const newList = updateSortOrders(selectedProducts.filter(p => !rightSelectedKeys.includes(p.MA_SPQD)));
    setSelectedProducts(newList);
    setRightSelectedKeys([]);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id !== over?.id) {
      setSelectedProducts((prev) => {
        const activeIndex = prev.findIndex((i) => i.MA_SPQD === active.id);
        const overIndex = prev.findIndex((i) => i.MA_SPQD === over?.id);
        const reordered = arrayMove(prev, activeIndex, overIndex);
        return updateSortOrders(reordered);
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: selectedProducts })
      });
      const json = await res.json();
      if (json.success) {
        message.success('Lưu cấu hình thành công');
      } else {
        message.error('Lỗi khi lưu: ' + json.error);
      }
    } catch (error) {
      message.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const leftColumns = [
    { title: 'Mã SP', dataIndex: 'MA_SPQD', width: 130, ellipsis: true, align: 'left' as const },
    { title: 'Tên Sản Phẩm', dataIndex: 'TEN_SPQD', ellipsis: true, align: 'left' as const },
  ];

  const rightColumns = [
    {
      title: '',
      key: 'drag',
      width: 40,
      align: 'center' as const,
      render: () => <HolderOutlined style={{ cursor: 'grab', color: '#8c8c8c' }} />
    },
    { title: 'STT', dataIndex: 'Thu_tu_sap_xep', width: 50, align: 'center' as const },
    { title: 'Mã SP', dataIndex: 'MA_SPQD', width: 130, ellipsis: true, align: 'left' as const },
    { title: 'Tên Sản Phẩm', dataIndex: 'TEN_SPQD', ellipsis: true, align: 'left' as const },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>


      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Cấu hình sản phẩm bao phủ</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Kéo thả để sắp xếp thứ tự hiển thị ưu tiên</Text>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
          style={{ height: 40, padding: '0 24px', borderRadius: 8 }}
        >
          Lưu
        </Button>
      </div>

      <Spin spinning={loading} description="Đang tải dữ liệu...">
        <Row gutter={16} style={{ flex: 1 }}>
          <Col span={10} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ marginBottom: 12 }}>
              <Input
                placeholder="Tìm mã hoặc tên sản phẩm..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
              />
            </div>
            <div className="kh-table">
              <CustomTable
                dataSource={leftTableData}
                columns={leftColumns}
                rowKey="MA_SPQD"
                pagination={{ pageSize: 100, pageSizeOptions: [100, 500, 1000], showSizeChanger: true }}
                rowSelection={{
                  selectedRowKeys: leftSelectedKeys,
                  onChange: setLeftSelectedKeys,
                }}
                onRow={(record) => ({
                  onClick: () => {
                    setLeftSelectedKeys(prev => 
                      prev.includes(record.MA_SPQD) 
                        ? prev.filter(key => key !== record.MA_SPQD) 
                        : [...prev, record.MA_SPQD]
                    );
                  },
                  style: { cursor: 'pointer' }
                })}
              />
            </div>
          </Col>

          <Col span={1} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <Button icon={<RightOutlined />} onClick={moveRight} disabled={leftSelectedKeys.length === 0} type="primary" />
            <Button icon={<LeftOutlined />} onClick={moveLeft} disabled={rightSelectedKeys.length === 0} />
          </Col>

          <Col span={13} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ height: 32, marginBottom: 12, display: 'flex', alignItems: 'center' }}>
              <Text strong>Danh sách sản phẩm bao phủ ({selectedProducts.length})</Text>
            </div>
            <div className="kh-table">
              <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
                <SortableContext items={selectedProducts.map((i) => i.MA_SPQD)} strategy={verticalListSortingStrategy}>
                  <CustomTable
                    virtual={false}
                    components={{ body: { row: RowDnD } }}
                    dataSource={selectedProducts}
                    columns={rightColumns}
                    rowKey="MA_SPQD"
                    pagination={false}
                    rowSelection={{
                      selectedRowKeys: rightSelectedKeys,
                      onChange: setRightSelectedKeys,
                    }}
                    onRow={(record) => ({
                      onClick: () => {
                        setRightSelectedKeys(prev => 
                          prev.includes(record.MA_SPQD) 
                            ? prev.filter(key => key !== record.MA_SPQD) 
                            : [...prev, record.MA_SPQD]
                        );
                      },
                      style: { cursor: 'pointer' }
                    })}
                  />
                </SortableContext>
              </DndContext>
            </div>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
