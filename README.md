# Android No-Code Automation Platform

Hệ thống tự động hóa No-Code cho các thiết bị Android sử dụng ReactFlow, NestJS và Android Accessibility Service.

## Cấu trúc thư mục
*   `/android-agent`: Mã nguồn Kotlin cho ứng dụng Agent cài trên thiết bị Android.
*   `/backend`: Mã nguồn NestJS quản lý nghiệp vụ, điều phối chạy workflow (Engine) và giao tiếp socket.
*   `/frontend`: Mã nguồn React + TypeScript + ReactFlow dùng để thiết kế và gỡ lỗi kịch bản trực quan.

## Khởi chạy nhanh
1. Cài đặt các gói phụ thuộc tại thư mục gốc:
   ```bash
   npm install
   ```
2. Chạy môi trường phát triển đồng thời cả Backend và Frontend:
   ```bash
   npm run dev
   ```
