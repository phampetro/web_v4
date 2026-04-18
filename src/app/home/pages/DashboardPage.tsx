import React from 'react';
import { Typography } from 'antd';

export default function DashboardPage({ ngayUpdate, setNgayUpdate }: { ngayUpdate?: string, setNgayUpdate?: (d: string) => void }) {
  return (
    <>
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Typography.Text type="secondary">Tổng quan hệ thống, các chỉ số quan trọng.</Typography.Text>
    </>
  );
}
