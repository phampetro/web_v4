# Next.js Project Structure Plan

## Mục tiêu
- Dễ mở rộng, bảo trì, nâng cấp từng trang và API.
- Phân tách rõ ràng FE/BE, logic, UI, và kết nối DB.

## Đề xuất cấu trúc

- src/
  - app/
    - login/
      - page.tsx         # Trang đăng nhập
      - LoginForm.tsx    # Component form đăng nhập
    - home/
      - page.tsx         # Trang home sau đăng nhập
    - layout.tsx         # Layout chung
    - page.tsx           # Trang landing (nếu cần)
  - components/
    - (các component dùng chung)
  - lib/
    - db.ts              # Kết nối SQL Server
    - auth.ts            # Logic xác thực
  - api/
    - auth/
      - route.ts         # API đăng nhập
  - types/
    - user.ts            # Định nghĩa kiểu dữ liệu user

## Ghi chú
- Tách biệt rõ ràng từng trang, component, logic backend, và kiểu dữ liệu.
- Dễ mở rộng thêm trang, API, hoặc logic mới.
- Đảm bảo bảo mật tối đa cho đăng nhập và session.
