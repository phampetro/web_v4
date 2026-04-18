import React from 'react';
import { Spin, Typography } from 'antd';

export default function LoadingModal({ message = 'Đang xử lý...' }: { message?: string }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.25)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 20,
        boxShadow: '0 8px 32px rgba(80,80,160,0.18)',
        padding: 36,
        minWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <Spin size="large" style={{ marginBottom: 24 }} />
        <Typography.Title level={5} style={{ margin: 0, color: '#1677ff', fontWeight: 700, letterSpacing: 1 }}>
          {message}
        </Typography.Title>
      </div>
    </div>
  );
}
