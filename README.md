# Yokool B2B CRM

CRM quản trị quan hệ khách hàng cho ngành quà tặng công nghệ B2B (ổ điện du lịch, sạc dây rút, sạc dự phòng).

## Tính năng

- **Dashboard** — Tổng quan số liệu, giá trị pipeline, lịch follow-up, báo giá gần đây
- **Pipeline cơ hội** — Kanban kéo-thả qua 6 giai đoạn bán hàng
- **Báo giá nhanh** — Form đầy đủ + xuất PDF tiếng Việt gửi khách
- **Lịch sử & Follow-up** — Ghi tương tác, nhắc lịch liên hệ lại (quá hạn / sắp tới)
- **Khách hàng B2B / Retail** — Danh mục đầy đủ, badge màu theo loại, tình trạng liên hệ
- **Mẫu chào hàng** — Theo kênh Email/Zalo/Call, có AI viết giúp
- **Kịch bản Sales Call** — Theo từng loại khách (MICE/Corporate/Event...), AI tạo kịch bản
- **Sản phẩm & Bảng giá** — Giá bậc thang theo số lượng
- **Đăng nhập** — Email + mật khẩu qua Supabase Auth

## Stack
React + Vite + TailwindCSS + Supabase + jsPDF

---

## Cài đặt & Deploy

### 1. Tạo bảng trong Supabase
Mở **SQL Editor** trong project Supabase của bạn, dán toàn bộ nội dung file
`supabase_schema.sql` và chạy. Tất cả bảng có prefix `crm_` nên không đụng app khác
trong cùng project.

> Auth: vào **Authentication → Providers → Email**, bật Email. Nếu muốn đăng nhập
> ngay không cần xác nhận email, tắt "Confirm email" trong Authentication → Settings.

### 2. Đẩy code lên GitHub
```bash
git init
git add .
git commit -m "init Yokool B2B CRM"
git remote add origin <repo-cua-ban>
git push -u origin main
```

### 3. Deploy trên Vercel
- Import repo vào Vercel (framework tự nhận **Vite**)
- Thêm **Environment Variables**:
  - `VITE_SUPABASE_URL` = URL project Supabase
  - `VITE_SUPABASE_ANON_KEY` = anon public key
  - `OPENAI_API_KEY` = key OpenAI (cho tính năng AI viết mẫu / kịch bản)
  - `OPENAI_MODEL` = (tùy chọn) mặc định `gpt-4o-mini`
- Deploy.

### 4. Chạy local (tùy chọn)
```bash
cp .env.example .env   # điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```
> Lưu ý: tính năng AI gọi qua `/api/ai` (serverless) nên chỉ hoạt động khi deploy
> trên Vercel hoặc chạy `vercel dev`. Khi `npm run dev` thuần Vite, các phần khác
> vẫn chạy bình thường, chỉ nút "AI viết giúp" cần môi trường Vercel.

---

## Cần chỉnh trước khi gửi báo giá
Mở `src/lib/quotePdf.js`, sửa thông tin công ty bạn trong object `SELLER`
(tên, địa chỉ, điện thoại, email, mã số thuế) để hiện đúng trên file PDF.
