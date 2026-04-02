-- ============================================================
-- CasaFinance — Seed Data
-- Run AFTER creating your account and getting your user UUID.
-- Replace YOUR_USER_UUID_HERE with your actual auth.users id.
-- ============================================================

-- TIP: After signing up in the app, run this in Supabase SQL Editor:
--   select id from auth.users where email = 'YOUR_EMAIL';
-- Then replace the variable below:

do $$
declare
  uid uuid := 'YOUR_USER_UUID_HERE';  -- <-- REPLACE THIS
begin

  -- ──────────────────────────────────────────────
  -- BILLS — Paycheck 1 (1st of month)
  -- ──────────────────────────────────────────────
  insert into public.bills (user_id, name, amount, due_day, paycheck, account, category, is_active, sort_order) values
    (uid, 'Macy''s Credit Card',        203.22,  4,  1, 'chase', 'Debt',         true,  1),
    (uid, 'Chase Freedom Unlimited',     500.00,  6,  1, 'chase', 'Debt',         true,  2),
    (uid, 'Members 1st Visa',            43.00,   7,  1, 'chase', 'Debt',         true,  3),
    (uid, 'Home Depot Credit Card',      67.00,   9,  1, 'chase', 'Debt',         true,  4),
    (uid, 'Verizon',                     244.00,  10, 1, 'chase', 'Phone',        true,  5),
    (uid, 'AEP Electric',               214.40,  15, 1, 'chase', 'Utility',      true,  6),
    (uid, 'Water/Sewer/Trash',           99.48,   15, 1, 'chase', 'Utility',      true,  7),
    (uid, 'Spectrum Internet',           40.00,   15, 1, 'chase', 'Utility',      true,  8),
    (uid, 'ADT Security',               64.00,   15, 1, 'chase', 'Utility',      true,  9),
    (uid, 'Culligan / Goodleap',         86.00,   15, 1, 'chase', 'Home',         true,  10),
    (uid, 'Spotify',                     23.00,   15, 1, 'chase', 'Subscription', true,  11),
    (uid, 'Planet Fitness',              27.00,   15, 1, 'chase', 'Subscription', true,  12),
    (uid, 'Apple Subscriptions',         70.00,   15, 1, 'chase', 'Subscription', true,  13),
    (uid, 'Xbox Game Pass',              17.69,   19, 1, 'chase', 'Subscription', true,  14),
    (uid, 'Citi Costco Visa',           220.00,   24, 1, 'chase', 'Debt',         true,  15),
    (uid, 'United Explorer Card',       185.00,   25, 1, 'chase', 'Debt',         true,  16),
    -- Inactive (Columbia Gas has $115 credit — skip April)
    (uid, 'Columbia Gas',               115.00,   20, 1, 'chase', 'Utility',      false, 17);

  -- ──────────────────────────────────────────────
  -- BILLS — Paycheck 2 (15th of month)
  -- ──────────────────────────────────────────────
  insert into public.bills (user_id, name, amount, due_day, paycheck, account, category, is_active, sort_order) values
    (uid, 'Carrington Mortgage',        2925.00, 15, 2, 'chase', 'Mortgage', true, 1);

  -- ──────────────────────────────────────────────
  -- DEBT ACCOUNTS
  -- ──────────────────────────────────────────────
  insert into public.debt_accounts (user_id, name, issuer, original_balance, current_balance, apr, min_payment, attack_phase, is_eliminated, sort_order) values
    (uid, 'Citi Costco Visa',         'Citi',        9408.00,  9408.00,  23.74, 220.00,  0, false, 1),
    (uid, 'United Explorer',          'Chase',       6089.00,  6089.00,  26.99, 185.00,  0, false, 2),
    (uid, 'Macy''s (Citibank)',       'Citibank',    4585.97,  4585.97,  32.74, 203.22,  1, false, 3),
    (uid, 'Home Depot',               'Citibank',    2008.51,  2008.51,  29.99,  67.00,  2, false, 4),
    (uid, 'Chase Freedom Unlimited',  'Chase',      13577.82, 13577.82,  27.24, 500.00,  3, false, 5),
    (uid, 'Members 1st Visa',         'Members 1st', 2109.74,  2109.74,  16.00,  43.00,  4, false, 6);

end $$;
