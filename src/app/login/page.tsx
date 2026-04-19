"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { message } from 'antd';
import LoginForm from './LoginForm';
import LoadingModal from '@/components/LoadingModal';



export default function LoginPage() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = React.useState('');
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.loggedIn) {
          router.replace('/home');
        } else {
          fetch('/api/auth/csrf')
            .then(res => res.json())
            .then(data => setCsrfToken(data.csrfToken))
            .finally(() => setChecking(false));
        }
      });
  }, [router]);

  const handleLogin = async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        return data.error === 'Invalid credentials'
          ? 'Sai tài khoản hoặc mật khẩu!'
          : data.error === 'CSRF token invalid'
            ? 'Phiên làm việc hết hạn, vui lòng tải lại trang!'
            : data.error || 'Đăng nhập thất bại';
      }
      
      const data = await res.json();
      if (data.user) {
        localStorage.setItem('user_info', JSON.stringify(data.user));
      }
      
      message.success('Đăng nhập thành công!');
      router.push('/home');
      return null;
    } catch (err) {
      return 'Lỗi hệ thống';
    }
  };

  if (checking) {
    return <LoadingModal message="Đang kiểm tra đăng nhập..." />;
  }
  return (
    <LoginForm onSubmit={handleLogin} />
  );
}
