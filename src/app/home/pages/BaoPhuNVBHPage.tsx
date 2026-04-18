"use client";
import React, { useState } from 'react';
import { Spin, Typography } from 'antd';
import CustomTable from '../../../components/CustomTable';

const { Title } = Typography;

interface Props {
  ngayUpdate: string;
  setNgayUpdate: (d: string) => void;
}

export default function BaoPhuNVBHPage({ ngayUpdate, setNgayUpdate }: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>


      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Bao phủ theo NVBH</Title>
        <div style={{ fontSize: 13, color: '#8c8c8c' }}>Tính năng đang được phát triển...</div>
      </div>

      <Spin spinning={loading}>
        <div className="kh-table">
          <CustomTable
            dataSource={[]}
            columns={[]}
            locale={{ emptyText: 'Dữ liệu đang được cập nhật' }}
          />
        </div>
      </Spin>
    </div>
  );
}
