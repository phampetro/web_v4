-- Tạo bảng đăng ký tạm ngưng khách hàng
-- Chạy script này trên SQL Server (database DMS_Report) trước khi sử dụng tính năng

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tbl_dangky_tamngung_kh' AND xtype='U')
BEGIN
    CREATE TABLE tbl_dangky_tamngung_kh (
        ID                INT IDENTITY(1,1) PRIMARY KEY,
        Khu_vuc           NVARCHAR(100),
        Ma_ten_nvbh       NVARCHAR(200),
        Ma_KH             NVARCHAR(50),
        Ten_KH            NVARCHAR(200),
        DC                NVARCHAR(500),
        Thu               NVARCHAR(20),
        Tan_suat          NVARCHAR(50),
        Ngay_dang_ky      DATETIME DEFAULT GETDATE(),
        Ngay_duyet        DATETIME NULL,
        Trang_thai_duyet  NVARCHAR(50) DEFAULT N'Chờ duyệt',
        Nguoi_dang_ky     NVARCHAR(100) NULL
    );

    PRINT N'Đã tạo bảng tbl_dangky_tamngung_kh thành công!';
END
ELSE
BEGIN
    PRINT N'Bảng tbl_dangky_tamngung_kh đã tồn tại.';
END
GO
