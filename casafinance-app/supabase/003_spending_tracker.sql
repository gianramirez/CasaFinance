-- ============================================================
-- CasaFinance — Spending Tracker Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────
-- ACCOUNT BALANCES (track checking account balances)
-- ──────────────────────────────────────────────
create table public.account_balances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account text not null check (account in ('chase', 'huntington')),
  balance numeric(10,2) not null,
  note text default '',
  effective_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.account_balances enable row level security;

create policy "Users can view own account balances"
  on public.account_balances for select using (auth.uid() = user_id);

create policy "Users can insert own account balances"
  on public.account_balances for insert with check (auth.uid() = user_id);

create policy "Users can update own account balances"
  on public.account_balances for update using (auth.uid() = user_id);

create policy "Users can delete own account balances"
  on public.account_balances for delete using (auth.uid() = user_id);

create index idx_account_balances_user_account on public.account_balances(user_id, account, created_at desc);

-- ──────────────────────────────────────────────
-- TRANSACTIONS (individual purchases / debits)
-- ──────────────────────────────────────────────
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account text not null default 'huntington' check (account in ('chase', 'huntington')),
  merchant text not null,
  amount numeric(10,2) not null,
  category text not null default 'Other',
  transaction_date date not null default current_date,
  receipt_image_path text,
  ai_extracted boolean not null default false,
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete using (auth.uid() = user_id);

create index idx_transactions_user_date on public.transactions(user_id, transaction_date desc);
create index idx_transactions_user_category on public.transactions(user_id, category);
create index idx_transactions_user_account on public.transactions(user_id, account);

create trigger set_updated_at before update on public.transactions
  for each row execute function public.update_updated_at();

-- ──────────────────────────────────────────────
-- SPENDING ALERTS (threshold alerts per account)
-- ──────────────────────────────────────────────
create table public.spending_alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account text not null check (account in ('chase', 'huntington')),
  threshold numeric(10,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spending_alerts enable row level security;

create policy "Users can view own spending alerts"
  on public.spending_alerts for select using (auth.uid() = user_id);

create policy "Users can insert own spending alerts"
  on public.spending_alerts for insert with check (auth.uid() = user_id);

create policy "Users can update own spending alerts"
  on public.spending_alerts for update using (auth.uid() = user_id);

create policy "Users can delete own spending alerts"
  on public.spending_alerts for delete using (auth.uid() = user_id);

create unique index idx_spending_alerts_unique on public.spending_alerts(user_id, account);

create trigger set_updated_at before update on public.spending_alerts
  for each row execute function public.update_updated_at();

-- ──────────────────────────────────────────────
-- STORAGE BUCKET for receipts
-- Note: Create the 'receipts' bucket in Supabase Dashboard > Storage
-- and add these policies manually:
--   SELECT: auth.uid()::text = (storage.foldername(name))[1]
--   INSERT: auth.uid()::text = (storage.foldername(name))[1]
--   DELETE: auth.uid()::text = (storage.foldername(name))[1]
-- ──────────────────────────────────────────────
