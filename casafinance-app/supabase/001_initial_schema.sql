-- ============================================================
-- CasaFinance — Full Database Schema
-- Run this in your Supabase SQL Editor (or as a migration)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ──────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ──────────────────────────────────────────────
-- BILLS
-- ──────────────────────────────────────────────
create table public.bills (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(10,2) not null,
  due_day integer not null check (due_day >= 1 and due_day <= 31),
  paycheck integer not null check (paycheck in (1, 2)),
  account text not null default 'chase' check (account in ('chase', 'huntington')),
  category text not null default 'Other',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bills enable row level security;

create policy "Users can view own bills"
  on public.bills for select using (auth.uid() = user_id);

create policy "Users can insert own bills"
  on public.bills for insert with check (auth.uid() = user_id);

create policy "Users can update own bills"
  on public.bills for update using (auth.uid() = user_id);

create policy "Users can delete own bills"
  on public.bills for delete using (auth.uid() = user_id);

create index idx_bills_user_id on public.bills(user_id);

-- ──────────────────────────────────────────────
-- BILL PAYMENTS
-- ──────────────────────────────────────────────
create table public.bill_payments (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  month integer not null check (month >= 0 and month <= 11),
  year integer not null,
  paid_date date not null default current_date,
  amount_paid numeric(10,2) not null,
  account_used text not null default 'chase' check (account_used in ('chase', 'huntington')),
  note text default '',
  created_at timestamptz not null default now()
);

alter table public.bill_payments enable row level security;

create policy "Users can view own bill payments"
  on public.bill_payments for select using (auth.uid() = user_id);

create policy "Users can insert own bill payments"
  on public.bill_payments for insert with check (auth.uid() = user_id);

create policy "Users can update own bill payments"
  on public.bill_payments for update using (auth.uid() = user_id);

create policy "Users can delete own bill payments"
  on public.bill_payments for delete using (auth.uid() = user_id);

create index idx_bill_payments_user_month on public.bill_payments(user_id, year, month);
create unique index idx_bill_payments_unique on public.bill_payments(bill_id, user_id, month, year);

-- ──────────────────────────────────────────────
-- DEBT ACCOUNTS
-- ──────────────────────────────────────────────
create table public.debt_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  issuer text not null default '',
  original_balance numeric(10,2) not null,
  current_balance numeric(10,2) not null,
  apr numeric(5,2) not null,
  min_payment numeric(10,2) not null default 0,
  attack_phase integer not null default 0,
  is_eliminated boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.debt_accounts enable row level security;

create policy "Users can view own debt accounts"
  on public.debt_accounts for select using (auth.uid() = user_id);

create policy "Users can insert own debt accounts"
  on public.debt_accounts for insert with check (auth.uid() = user_id);

create policy "Users can update own debt accounts"
  on public.debt_accounts for update using (auth.uid() = user_id);

create policy "Users can delete own debt accounts"
  on public.debt_accounts for delete using (auth.uid() = user_id);

create index idx_debt_accounts_user_id on public.debt_accounts(user_id);

-- ──────────────────────────────────────────────
-- DEBT PAYMENTS (history of balance updates)
-- ──────────────────────────────────────────────
create table public.debt_payments (
  id uuid primary key default uuid_generate_v4(),
  debt_account_id uuid not null references public.debt_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(10,2) not null,
  balance_after numeric(10,2) not null,
  note text default '',
  created_at timestamptz not null default now()
);

alter table public.debt_payments enable row level security;

create policy "Users can view own debt payments"
  on public.debt_payments for select using (auth.uid() = user_id);

create policy "Users can insert own debt payments"
  on public.debt_payments for insert with check (auth.uid() = user_id);

create index idx_debt_payments_user_id on public.debt_payments(user_id);
create index idx_debt_payments_debt_account on public.debt_payments(debt_account_id);

-- ──────────────────────────────────────────────
-- AI SUMMARIES
-- ──────────────────────────────────────────────
create table public.ai_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month integer not null check (month >= 0 and month <= 11),
  year integer not null,
  summary_text text not null,
  generated_at timestamptz not null default now()
);

alter table public.ai_summaries enable row level security;

create policy "Users can view own AI summaries"
  on public.ai_summaries for select using (auth.uid() = user_id);

create policy "Users can insert own AI summaries"
  on public.ai_summaries for insert with check (auth.uid() = user_id);

create unique index idx_ai_summaries_unique on public.ai_summaries(user_id, year, month);

-- ──────────────────────────────────────────────
-- UPDATED_AT TRIGGER (auto-update timestamps)
-- ──────────────────────────────────────────────
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger set_updated_at before update on public.bills
  for each row execute function public.update_updated_at();

create trigger set_updated_at before update on public.debt_accounts
  for each row execute function public.update_updated_at();
