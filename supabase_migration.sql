-- =============================================================
-- MIGRATION — chạy file này NẾU bạn đã chạy supabase_schema.sql
-- ở phiên bản trước (TechGift) và muốn cập nhật lên Yokool B2B
-- mà KHÔNG mất dữ liệu. An toàn chạy nhiều lần.
-- =============================================================

-- Mẫu chào hàng: thêm loại khách + ngữ cảnh/prompt AI
alter table crm_templates add column if not exists target_type text default 'corporate';
alter table crm_templates add column if not exists context_prompt text;

-- Kịch bản sales: thêm ngữ cảnh/prompt AI
alter table crm_scripts add column if not exists context_prompt text;

-- Khách hàng: phục vụ panel Sales (lý do từ chối)
alter table crm_customers add column if not exists reject_reason text;

-- Tách trạng thái sales khỏi tình trạng hợp tác
alter table crm_customers add column if not exists sales_status text default 'new';

-- Lịch sử sales: mảng JSON [{date, product, qty}]
alter table crm_customers add column if not exists sales_history jsonb default '[]'::jsonb;
