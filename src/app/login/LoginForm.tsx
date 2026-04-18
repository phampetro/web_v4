import React, { useState } from 'react';
import { Form, Input, Button, Alert, Card, Avatar, Typography, Spin, Divider } from 'antd';
import { LockOutlined, UserOutlined, LoginOutlined } from '@ant-design/icons';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<string | null>;
}

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setError('');
    setLoading(true);
    try {
      const errMsg = await onSubmit(values.username, values.password);
      if (errMsg) {
        setError(errMsg);
        setSuccess(false);
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Lỗi hệ thống, vui lòng thử lại sau!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #e0e7ff 0%, #f0f5ff 50%, #e6fffb 100%)',
    }}>
      <Card
        style={{
          width: 400,
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(22,119,255,0.12)',
          border: 'none',
        }}
        styles={{ body: { padding: '36px 32px 24px' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <Avatar
            size={64}
            style={{
              backgroundColor: '#1677ff',
              marginBottom: 12,
              boxShadow: '0 4px 14px rgba(22,119,255,0.3)',
            }}
            icon={<LockOutlined style={{ fontSize: 28 }} />}
          />
          <Typography.Title level={3} style={{ margin: 0, color: '#1677ff', fontWeight: 700 }}>
            Đăng nhập
          </Typography.Title>
          <Typography.Text type="secondary" style={{ marginTop: 4 }}>
            Vui lòng đăng nhập để tiếp tục
          </Typography.Text>
        </div>

        <Divider style={{ margin: '0 0 20px 0' }} />

        {error && (
          <Alert
            type="error"
            title="Đăng nhập thất bại"
            description={error}
            showIcon
            closable
            onClose={() => setError('')}
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}

        {success && (
          <Alert
            type="success"
            title="Đăng nhập thành công!"
            description="Đang chuyển hướng..."
            showIcon
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}

        <Spin spinning={loading} description="Đang xác thực...">
          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
            disabled={loading || success}
          >
            <Form.Item
              name="username"
              label={<span style={{ fontWeight: 600 }}>Tài khoản</span>}
              rules={[
                { required: true, message: 'Vui lòng nhập tài khoản!' },
                { min: 2, message: 'Tài khoản tối thiểu 2 ký tự!' },
              ]}
              style={{ marginBottom: 18 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#1677ff' }} />}
                placeholder="Nhập tài khoản"
                autoComplete="username"
                allowClear
              />
            </Form.Item>
            <Form.Item
              name="password"
              label={<span style={{ fontWeight: 600 }}>Mật khẩu</span>}
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu!' },
                { min: 4, message: 'Mật khẩu tối thiểu 4 ký tự!' },
              ]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#1677ff' }} />}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                icon={<LoginOutlined />}
                style={{
                  fontWeight: 700,
                  borderRadius: 8,
                  height: 46,
                  fontSize: 16,
                  boxShadow: '0 4px 14px rgba(22,119,255,0.25)',
                }}
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </Form.Item>
          </Form>
        </Spin>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            © 2026 Hệ thống quản lý
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}
