"use client";
import React, { useState, useEffect } from 'react';
import {
  ReloadOutlined,
  HomeOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  TeamOutlined,
  DashboardOutlined,
  DollarOutlined,
  AuditOutlined,
  EnvironmentOutlined,
  ToolOutlined,
  CheckSquareOutlined,
  AreaChartOutlined,
  NodeIndexOutlined,
  SolutionOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { setCookie, getCookie, clearAllCookies } from '../../utils/cookie';
import { useRouter } from 'next/navigation';
import {
  Layout, Menu, Avatar, Typography, Dropdown, Button, theme, Space, Modal, Form, Input, message,
} from 'antd';

import DashboardModule from './modules/dashboard/DashboardModule';
import KPSDSModule from './modules/khach-hang/KPSDSModule';
import ChoPhoModule from './modules/khach-hang/ChoPhoModule';
import DuyetChoPhoModule from './modules/khach-hang/DuyetChoPhoModule';
import DuyetTamNgungModule from './modules/khach-hang/DuyetTamNgungModule';
import DieuChinhModule from './modules/tuyen-ban-hang/DieuChinhModule';
import DuyetChinhModule from './modules/tuyen-ban-hang/DuyetChinhModule';
import XemNhanhModule from './modules/tuyen-ban-hang/XemNhanhModule';
import SanPhamModule from './modules/bao-cao-bao-phu/SanPhamModule';
import type { MenuProps } from 'antd';

const { Sider, Header, Content } = Layout;

const menuItems: MenuProps['items'] = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: 'khach-hang',
    icon: <TeamOutlined />,
    label: 'Khách hàng',
    children: [
      {
        key: 'khach-hang-kpsds',
        icon: <DollarOutlined />,
        label: 'Khách hàng KPSDS',
      },
      { key: 'khach-hang-cho-pho', label: 'Khách hàng Chợ - Phố', icon: <ShopOutlined /> },
      { key: 'duyet-cho-pho', label: 'Duyệt Chợ - Phố', icon: <CheckSquareOutlined /> },
      {
        key: 'khach-hang-duyet-tam-ngung',
        icon: <AuditOutlined />,
        label: 'Duyệt tạm ngưng',
      },
    ],
  },
  {
    key: 'tuyen-ban-hang',
    icon: <EnvironmentOutlined />,
    label: 'Tuyến bán hàng',
    children: [
      {
        key: 'tuyen-ban-hang-xem-nhanh',
        icon: <NodeIndexOutlined />,
        label: 'Xem nhanh tuyến',
      },
      {
        key: 'tuyen-ban-hang-dieu-chinh',
        icon: <ToolOutlined />,
        label: 'Điều chỉnh tuyến',
      },
      {
        key: 'tuyen-ban-hang-duyet-chinh',
        icon: <CheckSquareOutlined />,
        label: 'Duyệt chỉnh tuyến',
      },
    ],
  },
  {
    key: 'bao-cao-bao-phu',
    icon: <SettingOutlined />,
    label: 'Báo cáo bao phủ',
    children: [
      { key: 'bao-cao-bao-phu-san-pham', icon: <SettingOutlined />, label: 'Cấu hình sản phẩm' },
    ],
  },
];


interface PageProps {
  ngayUpdate: string;
  setNgayUpdate: (d: string) => void;
}

const moduleMap: Record<string, React.FC<PageProps>> = {
  dashboard: DashboardModule,
  'khach-hang-kpsds': KPSDSModule,
  'khach-hang-cho-pho': ChoPhoModule,
  'duyet-cho-pho': DuyetChoPhoModule,
  'khach-hang-duyet-tam-ngung': DuyetTamNgungModule,
  'tuyen-ban-hang-dieu-chinh': DieuChinhModule,
  'tuyen-ban-hang-xem-nhanh': XemNhanhModule,
  'tuyen-ban-hang-duyet-chinh': DuyetChinhModule,
  'bao-cao-bao-phu-san-pham': SanPhamModule,
};

export default function HomePage() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const { token } = theme.useToken();
  const [username, setUsername] = useState<string>('');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [passwordForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [ngayUpdate, setNgayUpdate] = useState<string>('');
  const [ngayUpdateLoading, setNgayUpdateLoading] = useState(false);

  // 1. Khai báo hàm fetchNgayUpdate (Full Init/Refresh)
  const fetchNgayUpdate = async (userParam?: string) => {
    const targetUser = userParam || username;
    if (!targetUser) return;

    setNgayUpdateLoading(true);
    try {
      const res = await fetch(`/api/cache-dung-chung?username=${encodeURIComponent(targetUser)}`);
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();

      if (data.ngayUpdate) {
        setNgayUpdate(data.ngayUpdate);
      }

      // Lưu Ngày Update, QuyenDL, Quyen và danh mục dùng chung vào IndexedDB
      const { setCacheMeta } = await import('../../utils/indexedDB');

      if (data.ngayUpdate) await setCacheMeta('common_ngay_update', data.ngayUpdate);
      if (data.quyenDL) await setCacheMeta('common_quyen_dl', data.quyenDL);
      if (data.quyen) await setCacheMeta('common_quyen_user', data.quyen);

      if (data.khuVucList) await setCacheMeta('common_khuvuc', JSON.stringify(data.khuVucList));
      if (data.nvbhList) await setCacheMeta('common_nvbh', JSON.stringify(data.nvbhList));

      if (!userParam) messageApi.success('Đã cập nhật dữ liệu mới nhất');

    } catch (error) {
      console.error('Init Error:', error);
      messageApi.error('Lỗi khởi tạo dữ liệu dùng chung');
    } finally {
      setNgayUpdateLoading(false);
    }
  };

  // 2. useEffect để khởi tạo khi load trang
  useEffect(() => {
    const userInfoStr = localStorage.getItem('user_info');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      const user = userInfo.username || '';
      setUsername(user);
      fetchNgayUpdate(user);
    }
  }, []);

  const handleLogout = async () => {
    try {
      // 1. Gọi API xóa session cookie
      await fetch('/api/auth/logout', { method: 'POST' });

      // 2. Xóa sạch thông tin User và các cờ trạng thái
      localStorage.clear();
      sessionStorage.clear();

      // 3. Xóa Cookies (nếu còn)
      clearAllCookies();

      // 4. Xóa sạch dữ liệu cache trong IndexedDB
      const { clearAllCache } = await import('../../utils/indexedDB');
      await clearAllCache();

      // 5. Chuyển hướng
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Dù lỗi API vẫn nên xóa local và chuyển hướng
      localStorage.clear();
      router.replace('/login');
    }
  };

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    setChangePasswordLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, username }),
      });
      const data = await res.json();
      if (!res.ok) {
        messageApi.error(data.error || 'Đổi mật khẩu thất bại');
      } else {
        messageApi.success('Đổi mật khẩu thành công!');
        setChangePasswordOpen(false);
        passwordForm.resetFields();
      }
    } catch {
      messageApi.error('Lỗi kết nối server');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const userDropdownItems: MenuProps['items'] = [
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: 'Đổi mật khẩu',
      onClick: () => setChangePasswordOpen(true),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    },
  ];



  const pageTitleMap: Record<string, string> = {
    dashboard: 'Dashboard',
    'khach-hang-kpsds': 'Khách hàng KPSDS',
    'khach-hang-cho-pho': 'Báo cáo Khách hàng Chợ - Phố',
    'duyet-cho-pho': 'Phê duyệt phân loại Chợ - Phố',
    'khach-hang-duyet-tam-ngung': 'Duyệt tạm ngưng',
    'tuyen-ban-hang-xem-nhanh': 'Xem nhanh tuyến',
    'tuyen-ban-hang-dieu-chinh': 'Điều chỉnh tuyến',
    'tuyen-ban-hang-duyet-chinh': 'Duyệt chỉnh tuyến',
    'bao-cao-bao-phu-san-pham': 'Cấu hình sản phẩm',
  };

  const renderContent = () => {
    switch (selectedKey) {
      case 'khach-hang-cho-pho': return <ChoPhoModule ngayUpdate={ngayUpdate} setNgayUpdate={setNgayUpdate} />;
      case 'duyet-cho-pho': return <DuyetChoPhoModule ngayUpdate={ngayUpdate} setNgayUpdate={setNgayUpdate} />;
      default: {
        const PageComponent = moduleMap[selectedKey] || DashboardModule;
        return <PageComponent ngayUpdate={ngayUpdate} setNgayUpdate={setNgayUpdate} />;
      }
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="Đổi mật khẩu"
        open={changePasswordOpen}
        onCancel={() => { setChangePasswordOpen(false); passwordForm.resetFields(); }}
        footer={null}
        destroyOnHidden
        centered
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="oldPassword"
            label="Mật khẩu hiện tại"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu hiện tại" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu mới" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setChangePasswordOpen(false); passwordForm.resetFields(); }}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={changePasswordLoading}>Đổi mật khẩu</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      <Layout style={{ height: '100vh' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={260}
          collapsedWidth={72}
          style={{
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Logo / Header */}
            <div style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? 0 : '0 20px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              flexShrink: 0,
            }}>
              <HomeOutlined style={{ fontSize: 24, color: '#1677ff' }} />
              {!collapsed && (
                <Typography.Title level={5} style={{ margin: '0 0 0 12px', color: '#1677ff', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  DMS Report V4
                </Typography.Title>
              )}
            </div>

            {/* Ngày cập nhật */}
            <div style={{
              padding: collapsed ? '8px 0' : '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              fontSize: 13,
              color: token.colorTextSecondary,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              flexShrink: 0,
              transition: 'padding 0.2s ease',
            }}>
              <span style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxWidth: collapsed ? 0 : 120,
                opacity: collapsed ? 0 : 1,
                transition: 'max-width 0.2s ease, opacity 0.2s ease',
                fontStyle: 'italic',
              }}>Data Updated:</span>
              <span style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxWidth: collapsed ? 0 : 100,
                opacity: collapsed ? 0 : 1,
                transition: 'max-width 0.2s ease, opacity 0.2s ease',
                fontWeight: 'bold',
              }}>
                {ngayUpdateLoading ? '...' : (ngayUpdate ? dayjs(ngayUpdate).format('DD/MM/YYYY') : '--/--/----')}
              </span>
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined spin={ngayUpdateLoading} />}
                onClick={() => fetchNgayUpdate()}
                style={{ color: token.colorPrimary, flexShrink: 0 }}
                title="Cập nhật lại ngày"
                tabIndex={-1}
              />
            </div>

            {/* Menu */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                defaultOpenKeys={['khach-hang', 'tuyen-ban-hang', 'bao-cao-bao-phu']}
                items={menuItems}
                style={{ border: 'none', marginTop: 8 }}
                onClick={({ key }) => setSelectedKey(key)}
              />
            </div>

            {/* User info - marginTop auto đẩy xuống đáy */}
            <div style={{
              marginTop: 'auto',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              padding: collapsed ? '12px 0' : '12px 16px',
              display: 'flex',
              justifyContent: collapsed ? 'center' : 'flex-start',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <Dropdown menu={{ items: userDropdownItems }} placement="topRight" trigger={['click']}>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />
                  <div style={{
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    maxWidth: collapsed ? 0 : 120,
                    opacity: collapsed ? 0 : 1,
                    transition: 'max-width 0.2s ease, opacity 0.2s ease',
                  }}>
                    <Typography.Text strong style={{ display: 'block', lineHeight: 1.3, fontSize: 13 }}>
                      {username || 'Người dùng'}
                    </Typography.Text>
                  </div>
                </div>
              </Dropdown>
            </div>
          </div>
        </Sider>

        <Layout style={{ marginLeft: collapsed ? 72 : 260, transition: 'margin-left 0.2s', height: '100vh' }}>
          {/* Top Header */}
          <Header style={{
            background: token.colorBgContainer,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            flexShrink: 0,
            zIndex: 50,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 18, marginRight: 16 }}
            />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {pageTitleMap[selectedKey] || 'Dashboard'}
            </Typography.Title>
          </Header>

          {/* Content */}
          <Content style={{ margin: 10, padding: 24, background: token.colorBgContainer, borderRadius: 12, flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </>
  );
}
