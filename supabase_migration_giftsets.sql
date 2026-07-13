-- =============================================================
-- MIGRATION — Set quà (gift sets) + tên rút gọn sản phẩm
-- + tên trên hóa đơn. An toàn chạy nhiều lần (idempotent).
-- Chạy sau supabase_schema.sql / các migration trước.
-- =============================================================

-- 1) SẢN PHẨM: tên rút gọn (dùng trong báo giá) + tên trên hóa đơn
alter table crm_products add column if not exists short_name text;
alter table crm_products add column if not exists invoice_name text;

-- 2) BÁO GIÁ: hỗ trợ item là set quà (đã lưu trong items jsonb nên không cần cột mới)
--    Giữ nguyên cấu trúc items; mỗi item có thể có kind='product'|'set'.

-- 3) SET QUÀ (combo 2–3 sản phẩm)
create table if not exists crm_gift_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,                            -- tên set quà (tùy đặt)
  short_name text,                               -- tên rút gọn hiện trong báo giá
  invoice_name text,                             -- tên trên hóa đơn
  sku text,                                       -- mã set (để gõ nhanh trong báo giá)
  unit text default 'set',
  price numeric default 0,                       -- đơn giá set (chưa VAT) — có thể sửa tay
  auto_price boolean default true,               -- true = tự cộng giá thành phần
  items jsonb default '[]'::jsonb,               -- [{product_id, name, sku, qty, price, image_url}]
  description text,                              -- thông số/ghi chú gộp
  image_url text,                                -- ảnh đại diện set (base64 hoặc URL)
  created_at timestamptz default now()
);

-- RLS cho bảng mới: mỗi user chỉ thấy dữ liệu của mình
alter table crm_gift_sets enable row level security;
drop policy if exists "own_rows" on crm_gift_sets;
create policy "own_rows" on crm_gift_sets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
