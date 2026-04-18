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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { setCookie, getCookie, clearAllCookies } from '../../utils/cookie';
import { useRouter } from 'next/navigation';
import {
  Layout, Menu, Avatar, Typography, Dropdown, Button, theme, Space, Modal, Form, Input, message,
} from 'antd';

import DashboardPage from './pages/DashboardPage';
import KH_KPSDSPage from './pages/KH_KPSDSPage';
import DuyetTamNgungPage from './pages/DuyetTamNgungPage';
import DieuChinhTuyenPage from './pages/DieuChinhTuyenPage';
import DuyetDieuChinhTuyenPage from './pages/DuyetDieuChinhTuyenPage';
import CauHinhSanPhamPage from './pages/CauHinhSanPhamPage';
import BaoPhuKhuVucPage from './pages/BaoPhuKhuVucPage';
import BaoPhuNVBHPage from './pages/BaoPhuNVBHPage';
import BaoPhuTuyenPage from './pages/BaoPhuTuyenPage';
import BaoPhuKhachHangPage from './pages/BaoPhuKhachHangPage';
import type { MenuProps } from 'antd';

const { Sider, Header, Content } = Layout;

const menuItems: MenuProps['items'] = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: 'kh_group',
    icon: <TeamOutlined />,
    label: 'Danh sách khách hàng',
    children: [
      {
        key: 'kh_kpsds',
        icon: <DollarOutlined />,
        label: 'Khách hàng KPSDS',
      },
      {
        key: 'duyet_tamngung',
        icon: <AuditOutlined />,
        label: 'Duyệt tạm ngưng',
      },
    ],
  },
  {
    key: 'tuyen_ban_hang',
    icon: <EnvironmentOutlined />,
    label: 'Tuyến bán hàng',
    children: [
      {
        key: 'dieu_chinh_tuyen',
        icon: <ToolOutlined />,
        label: 'Điều chỉnh tuyến',
      },
      {
        key: 'duyet_dieu_chinh_tuyen',
        icon: <CheckSquareOutlined />,
        label: 'Duyệt chỉnh tuyến',
      },
    ],
  },
  {
    key: 'bao_cao_bao_phu',
    icon: <BarChartOutlined />,
    label: 'Báo cáo bao phủ',
    children: [
      { key: 'cau_hinh_san_pham', icon: <SettingOutlined />, label: 'Cấu hình sản phẩm' },
      { key: 'bao_phu_khu_vuc', icon: <AreaChartOutlined />, label: 'Xem theo khu vực' },
      { key: 'bao_phu_nvbh', icon: <UserOutlined />, label: 'Xem theo NVBH' },
      { key: 'bao_phu_tuyen', icon: <NodeIndexOutlined />, label: 'Xem theo tuyến' },
      { key: 'bao_phu_khach_hang', icon: <SolutionOutlined />, label: 'Xem theo khách hàng' },
    ],
  },
  // {
  //   key: 'reports',
  //   icon: <BarChartOutlined />,
  //   label: 'Báo cáo',
  //   children: [
  //     { key: 'report-sales', icon: <FileTextOutlined />, label: 'Báo cáo bán hàng' },
  //     { key: 'report-inventory', icon: <FileTextOutlined />, label: 'Báo cáo tồn kho' },
  //   ],
  // },
  // {
  //   key: 'users',
  //   icon: <TeamOutlined />,
  //   label: 'Quản lý người dùng',
  // },
  // {
  //   key: 'settings',
  //   icon: <SettingOutlined />,
  //   label: 'Cài đặt',
  // },
];


interface PageProps {
  ngayUpdate: string;
  setNgayUpdate: (d: string) => void;
}

const pageComponentMap: Record<string, React.FC<PageProps>> = {
  dashboard: DashboardPage,
  kh_kpsds: KH_KPSDSPage,
  duyet_tamngung: DuyetTamNgungPage,
  dieu_chinh_tuyen: DieuChinhTuyenPage,
  duyet_dieu_chinh_tuyen: DuyetDieuChinhTuyenPage,
  cau_hinh_san_pham: CauHinhSanPhamPage,
  bao_phu_khu_vuc: BaoPhuKhuVucPage,
  bao_phu_nvbh: BaoPhuNVBHPage,
  bao_phu_tuyen: BaoPhuTuyenPage,
  bao_phu_khach_hang: BaoPhuKhachHangPage,
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

  // Đọc username và ngày cập nhật từ cookie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = document.cookie.match(/(?:^|; )username=([^;]*)/);
      if (match) {
        setUsername(decodeURIComponent(match[1]));
      }
      const ngay = getCookie('ngay_update');
      if (ngay) setNgayUpdate(ngay);
      else fetchNgayUpdate();
    }
    // eslint-disable-next-line
  }, []);

  // Lấy ngày cập nhật từ API và lưu cookie
  const fetchNgayUpdate = async () => {
    setNgayUpdateLoading(true);
    try {
      const res = await fetch('/api/ngay-update');
      const data = await res.json();
      if (data.ngayUpdate) {
        setNgayUpdate(data.ngayUpdate);
        setCookie('ngay_update', data.ngayUpdate, 7);
      } else {
        setNgayUpdate('');
        messageApi.error('Không lấy được ngày cập nhật');
      }
    } catch {
      setNgayUpdate('');
      messageApi.error('Lỗi kết nối ngày cập nhật');
    } finally {
      setNgayUpdateLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    clearAllCookies();
    try { const { clearAllCache } = await import('../../utils/indexedDB'); await clearAllCache(); } catch { }
    router.replace('/login');
  };

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string }) => {
    setChangePasswordLoading(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
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
    'report-sales': 'Báo cáo bán hàng',
    'report-inventory': 'Báo cáo tồn kho',
    users: 'Quản lý người dùng',
    settings: 'Cài đặt',
    kh_kpsds: 'Khách hàng KPSDS',
    ds_kh_3m: 'Doanh số KH 3T',
    duyet_tamngung: 'Duyệt tạm ngưng',
    dieu_chinh_tuyen: 'Điều chỉnh tuyến',
    duyet_dieu_chinh_tuyen: 'Duyệt chỉnh tuyến',
    cau_hinh_san_pham: 'Cấu hình sản phẩm',
    bao_phu_khu_vuc: 'Bao phủ theo khu vực',
    bao_phu_nvbh: 'Bao phủ theo NVBH',
    bao_phu_tuyen: 'Bao phủ theo tuyến',
    bao_phu_khach_hang: 'Bao phủ theo khách hàng',
  };

  const PageComponent = pageComponentMap[selectedKey] || DashboardPage;

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
          width={240}
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
                onClick={fetchNgayUpdate}
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
                defaultOpenKeys={['kh_group', 'tuyen_ban_hang', 'bao_cao_bao_phu']}
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

        <Layout style={{ marginLeft: collapsed ? 72 : 240, transition: 'margin-left 0.2s', height: '100vh' }}>
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
            <PageComponent ngayUpdate={ngayUpdate} setNgayUpdate={setNgayUpdate} />
          </Content>
        </Layout>
      </Layout>
    </>
  );
}
