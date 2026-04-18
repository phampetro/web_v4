"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from './LoginForm';
import LoadingModal from '@/components/LoadingModal';



export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = React.useState('');
  const [csrfToken, setCsrfToken] = React.useState('');
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(data => {
        if (data.loggedIn) {
          router.replace('/home');
        } else {
          fetch('/api/csrf')
            .then(res => res.json())
            .then(data => setCsrfToken(data.csrfToken))
            .finally(() => setChecking(false));
        }
      });
  }, [router]);

  const handleLogin = async (username: string, password: string): Promise<string | null> => {
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        const msg = data.error === 'Invalid credentials'
          ? 'Sai tài khoản hoặc mật khẩu!'
          : data.error === 'CSRF token invalid'
            ? 'Phiên làm việc hết hạn, vui lòng tải lại trang!'
            : data.error || 'Đăng nhập thất bại';
        setError(msg);
        return msg;
      }
      router.push('/home');
      return null;
    } catch (err) {
      setError('Lỗi hệ thống');
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
