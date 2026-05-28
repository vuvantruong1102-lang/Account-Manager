-- =============================================================
-- TechGift CRM — Supabase schema
-- Tất cả bảng dùng prefix "crm_" để tránh đụng độ với app khác
-- trong cùng project. Chạy toàn bộ file này trong SQL Editor.
-- =============================================================

-- 1. KHÁCH HÀNG (gộp B2B + Retail, phân biệt bằng segment)
create table if not exists crm_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  segment text not null default 'b2b',          -- 'b2b' | 'retail'
  company_name text not null,
  address text,
  phone text,
  tax_code text,                                 -- mã số thuế
  website text,                                  -- website công ty
  contact_person text,                           -- người liên hệ
  contact_email text,
  contact_phone text,                            -- sđt người liên hệ
  customer_type text default 'corporate',        -- mice | corporate | event | agency | retail | other
  suitable_products text,                        -- mặt hàng phù hợp
  contact_status text default 'not_partner',    -- tình trạng hợp tác: not_partner | partner
  sales_status text default 'new',               -- trạng thái sales: new|contacted|quoted|won|done|rejected
  sales_history jsonb default '[]'::jsonb,       -- lịch sử sales: [{date, product, qty}]
  reject_reason text,                            -- (giữ để tương thích dữ liệu cũ)
  notes text,
  created_at timestamptz default now()
);

-- 2. SẢN PHẨM / BẢNG GIÁ
create table if not exists crm_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  sku text,
  unit text default 'cái',
  base_price numeric default 0,                  -- giá lẻ tham chiếu
  tiers jsonb default '[]'::jsonb,               -- [{min_qty, price}] giá bậc thang
  description text,
  created_at timestamptz default now()
);

-- 3. MẪU CHÀO HÀNG
create table if not exists crm_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  channel text default 'email',                  -- email | zalo | call | facebook | other
  target_type text default 'corporate',          -- loại khách: mice | corporate | event ...
  context_prompt text,                            -- ngữ cảnh & prompt hướng dẫn AI
  content text,
  created_at timestamptz default now()
);

-- 4. KỊCH BẢN SALES CALL
create table if not exists crm_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  target_type text default 'corporate',          -- mice | corporate | event ...
  context_prompt text,                            -- ngữ cảnh & prompt hướng dẫn AI
  content text,
  created_at timestamptz default now()
);

-- 5. CƠ HỘI / DEAL (pipeline Kanban)
create table if not exists crm_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id uuid references crm_customers(id) on delete set null,
  title text not null,
  stage text default 'lead',                      -- lead | contacted | quoted | negotiating | won | lost
  value numeric default 0,
  expected_close date,
  notes text,
  created_at timestamptz default now()
);

-- 6. LỊCH SỬ TƯƠNG TÁC + NHẮC FOLLOW-UP
create table if not exists crm_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id uuid references crm_customers(id) on delete cascade,
  type text default 'note',                       -- call | email | zalo | meeting | note
  summary text,
  follow_up_date date,                            -- ngày cần liên hệ lại
  done boolean default false,
  created_at timestamptz default now()
);

-- 7. BÁO GIÁ
create table if not exists crm_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  quote_number text,
  company_name text,
  address text,
  tax_code text,
  contact_person text,
  contact_email text,
  items jsonb default '[]'::jsonb,                -- [{name, qty, unit, price}]
  vat_percent numeric default 8,
  discount numeric default 0,
  notes text,
  valid_until date,
  created_at timestamptz default now()
);

-- =============================================================
-- ROW LEVEL SECURITY: mỗi user chỉ thấy dữ liệu của mình
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'crm_customers','crm_products','crm_templates','crm_scripts',
    'crm_deals','crm_interactions','crm_quotes'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "own_rows" on %I;', t);
    execute format($f$
      create policy "own_rows" on %I
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;
