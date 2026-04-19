import React from 'react';
import { Typography } from 'antd';

export default function DashboardModule() {
  return (
    <div style={{ padding: 20 }}>
      <Typography.Title level={2}>Chào mừng bạn quay trở lại!</Typography.Title>
      <Typography.Paragraph>
        Đây là hệ thống quản lý DMS Report V4. Vui lòng chọn chức năng ở menu bên trái để bắt đầu.
      </Typography.Paragraph>
    </div>
  );
}
