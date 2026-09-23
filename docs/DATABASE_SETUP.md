# Tạo PostgreSQL cho Kolosseum (M1)

Kolosseum dùng PostgreSQL riêng để lưu **chỉ** các bảng mới có tiền tố `dr_`. Dữ liệu KOL và bài đăng vẫn được đọc từ Radar thật; không import hoặc sửa dữ liệu Radar.

1. Mở [Neon Console](https://console.neon.tech/), đăng ký/đăng nhập, chọn **Create project**. Đặt tên `kolosseum-demo`, chọn region gần nơi chạy app. Có thể giữ tên database mặc định `neondb`.
2. Trong dashboard của project, bấm **Connect** và chọn database/branch vừa tạo. Sao chép **connection string** dạng `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`. Dùng kết nối trực tiếp cho môi trường local M1; chế độ pooled có thể dùng sau cho triển khai serverless.
3. Mở file `D:\VibeCode\Kolosseum\.env.local` đang được Git bỏ qua. Thêm hoặc điền đúng **một** dòng `DATABASE_URL=postgresql://...` bằng chuỗi vừa sao chép. Giữ nguyên các dòng `REPORT_ENC_KEY`, `ADMIN_TOKEN`, `OPERATOR_KEYPAIR_PATH` do `npm run research:init-devnet` đã tạo. Không gửi URL hoặc mật khẩu qua chat và không commit `.env.local`.
4. Từ PowerShell tại `D:\VibeCode\Kolosseum`, chạy `npm run research:migrate`. Khi thành công, lệnh in `Applied dr_ migration and seeded three templates.` Migration chỉ tạo `dr_templates`, `dr_reports`, `dr_votes`, `dr_channels`, `dr_evidence_jobs` và 3 mẫu báo cáo.
5. Chạy `npm run research:dev` trong một terminal khác, rồi mở `http://127.0.0.1:4174/templates`. Khi database kết nối thành công, API trả 3 template. Nếu báo lỗi kết nối, kiểm tra lại host, password và `sslmode=require` trên **máy của bạn**, không dán credential vào issue/chat.

Theo [hướng dẫn tạo project của Neon](https://neon.com/blog/serverless-api-using-aws-lambda-cdk-and-neon), connection string xuất hiện sau khi tạo project và có thể lấy lại từ dashboard. [Neon cũng giải thích](https://neon.com/blog/postgres-support-case-recap) lựa chọn pooled connection trong phần Connection Details; M1 local không cần bật tuỳ chọn đó.
