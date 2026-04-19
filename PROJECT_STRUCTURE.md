# Cấu trúc dự án Next.js (Hiện tại)

Dự án được tổ chức theo cấu trúc chuẩn của Next.js (App Router) kết hợp với mô hình Module hóa cho phần dashboard.

## Thư mục chính

### 1. `src/app` (App Router)
Đây là nơi chứa các route (trang) và API của ứng dụng.

- **`/`**: Trang landing (điều hướng dựa trên trạng thái đăng nhập).
- **`/login`**: Trang đăng nhập (`page.tsx`) và form xử lý (`LoginForm.tsx`).
- **`/home`**: Dashboard chính sau khi đăng nhập.
  - **`page.tsx`**: Trang chủ điều phối các module.
  - **`modules/`**: Chứa các component chức năng lớn (Module):
    - `cau-hinh/`: Quản lý cấu hình (Sản phẩm).
    - `dashboard/`: Tổng quan.
    - `khach-hang/`: Quản lý khách hàng (KPSDS, Duyệt tạm ngừng).
    - `tuyen-ban-hang/`: Quản lý tuyến (Điều chỉnh, Duyệt chỉnh).
- **`api/`**: Các API Route xử lý backend:
  - `auth/`: Login, logout, me, change-password, csrf.
  - `cache-dung-chung/`: API lấy dữ liệu cache dùng chung.
  - `cau-hinh/`: API liên quan đến cấu hình sản phẩm.
  - `khach-hang/`: API cho KPSDS, tạm ngừng, chỉnh tuyến.
  - `tuyen-ban-hang/`: API điều chỉnh tuyến.

### 2. `src/components`
Chứa các UI component dùng chung cho toàn bộ dự án.
- `CustomTable.tsx`: Component bảng dữ liệu tùy chỉnh (hỗ trợ virtual scroll).
- `LoadingModal.tsx`: Modal hiển thị trạng thái đang tải.

### 3. `src/lib`
Chứa các thư viện kết nối và cấu hình lõi.
- `db.ts`: Cấu hình kết nối SQL Server (sử dụng `mssql`).
- `auth.ts`: Xử lý JWT và xác thực người dùng.

### 4. `src/hooks` & `src/utils`
- `hooks/useCachedData.ts`: Hook quản lý dữ liệu cache từ IndexedDB.
- `utils/indexedDB.ts`: Logic tương tác với IndexedDB ở client.
- `utils/cookie.ts`: Tiện ích xử lý cookie.

### 5. Các thư mục khác
- **`sql/`**: Chứa các script tạo bảng hoặc stored procedure SQL.
- **`tools/`**: Các script hỗ trợ (ví dụ: `hash_password.ts`).
- **`public/`**: Tài nguyên tĩnh (ảnh, icons).

## Công nghệ sử dụng
- **Framework**: Next.js 15 (App Router).
- **UI Library**: Ant Design (antd).
- **Database**: SQL Server.
- **State Management**: React Hooks + IndexedDB cho caching.
- **Styling**: Vanilla CSS + Ant Design.

## Ghi chú quan trọng
- Logic nghiệp vụ phức tạp được tách vào các **Modules** trong `src/app/home/modules` để dễ quản lý.
- Dữ liệu danh mục được cache tại client qua **IndexedDB** để tăng tốc độ phản hồi UI.
- Khi Code bạn không được tự ý mở rộng nội dung khi không được yêu cầu.
- Yêu cầu sửa ở đâu tập trung vào sửa/nâng cấp tại khu vực đó, nếu sửa có liên quan phải hỏi lại người dùng trước.
- Khi sửa và thêm thư viện chú ý các import thư viện để không bị lỗi cơ bản.
- Chú ý ràng buộc về mặt giao diện Ant, hoặc học hỏi từ các trang đang hoàn thiện ví dụ KPSDSModule.tsx
