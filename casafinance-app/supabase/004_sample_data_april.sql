-- ============================================================
-- CasaFinance — April 2026 Sample Data (for screenshots)
-- Run AFTER 001, 002, 003 migrations and seed data.
-- Replace YOUR_USER_UUID_HERE with your actual auth.users id.
-- ============================================================

do $$
declare
  uid uuid := 'YOUR_USER_UUID_HERE';  -- <-- REPLACE THIS
  bill_id uuid;
begin

  -- ──────────────────────────────────────────────
  -- ACCOUNT BALANCES (set after April 1 paycheck)
  -- ──────────────────────────────────────────────
  insert into public.account_balances (user_id, account, balance, note, effective_date) values
    (uid, 'chase',      1842.50, 'Paycheck 1 deposit', '2026-04-01'),
    (uid, 'huntington',  985.00, 'Paycheck 1 deposit', '2026-04-01');

  -- ──────────────────────────────────────────────
  -- BILL PAYMENTS — April 2026 (month=3, 0-indexed)
  -- Mark bills due on/before Apr 8 as paid
  -- ──────────────────────────────────────────────

  -- Macy's Credit Card (due 4th)
  select id into bill_id from public.bills where user_id = uid and name = 'Macy''s Credit Card' limit 1;
  insert into public.bill_payments (bill_id, user_id, month, year, paid_date, amount_paid, account_used, note)
    values (bill_id, uid, 3, 2026, '2026-04-03', 203.22, 'chase', '');

  -- Chase Freedom Unlimited (due 6th)
  select id into bill_id from public.bills where user_id = uid and name = 'Chase Freedom Unlimited' limit 1;
  insert into public.bill_payments (bill_id, user_id, month, year, paid_date, amount_paid, account_used, note)
    values (bill_id, uid, 3, 2026, '2026-04-05', 500.00, 'chase', '');

  -- Members 1st Visa (due 7th)
  select id into bill_id from public.bills where user_id = uid and name = 'Members 1st Visa' limit 1;
  insert into public.bill_payments (bill_id, user_id, month, year, paid_date, amount_paid, account_used, note)
    values (bill_id, uid, 3, 2026, '2026-04-06', 43.00, 'chase', '');

  -- ──────────────────────────────────────────────
  -- TRANSACTIONS — April 1–8 daily spending
  -- ──────────────────────────────────────────────
  insert into public.transactions (user_id, account, merchant, amount, category, transaction_date, note) values
    -- Apr 1 (Wednesday)
    (uid, 'huntington', 'Kroger',              62.47, 'Groceries',      '2026-04-01', 'Weekly groceries'),
    (uid, 'huntington', 'Shell Gas Station',   41.83, 'Gas',            '2026-04-01', ''),
    (uid, 'huntington', 'Starbucks',            6.75, 'Dining',         '2026-04-01', 'Morning coffee'),

    -- Apr 2 (Thursday)
    (uid, 'huntington', 'Chipotle',            12.95, 'Dining',         '2026-04-02', 'Lunch'),
    (uid, 'huntington', 'Amazon',              34.99, 'Shopping',       '2026-04-02', 'Phone case + charger'),

    -- Apr 3 (Friday)
    (uid, 'huntington', 'Costco',              89.14, 'Groceries',      '2026-04-03', 'Bulk run'),
    (uid, 'huntington', 'Netflix',             15.49, 'Entertainment',  '2026-04-03', 'Monthly subscription'),
    (uid, 'chase',      'Walgreens',           11.29, 'Health',         '2026-04-03', 'Vitamins'),

    -- Apr 4 (Saturday)
    (uid, 'huntington', 'Target',              53.88, 'Shopping',       '2026-04-04', 'Household items'),
    (uid, 'huntington', 'Chick-fil-A',          9.47, 'Dining',         '2026-04-04', ''),
    (uid, 'huntington', 'Speedway',            38.50, 'Gas',            '2026-04-04', ''),

    -- Apr 5 (Sunday)
    (uid, 'huntington', 'Walmart',             27.63, 'Groceries',      '2026-04-05', 'Quick stop'),
    (uid, 'huntington', 'Uber Eats',           22.40, 'Dining',         '2026-04-05', 'Sunday dinner'),

    -- Apr 6 (Monday)
    (uid, 'huntington', 'Starbucks',            6.75, 'Dining',         '2026-04-06', 'Morning coffee'),
    (uid, 'huntington', 'Home Depot',          18.97, 'Home',           '2026-04-06', 'Light bulbs'),
    (uid, 'chase',      'CVS Pharmacy',        24.50, 'Health',         '2026-04-06', 'Prescriptions'),

    -- Apr 7 (Tuesday)
    (uid, 'huntington', 'Kroger',              45.32, 'Groceries',      '2026-04-07', 'Midweek groceries'),
    (uid, 'huntington', 'Wendy''s',             8.99, 'Dining',         '2026-04-07', 'Lunch'),
    (uid, 'huntington', 'AMC Theatres',        14.50, 'Entertainment',  '2026-04-07', 'Movie night'),

    -- Apr 8 (Wednesday)
    (uid, 'huntington', 'Shell Gas Station',   39.75, 'Gas',            '2026-04-08', ''),
    (uid, 'huntington', 'Panera Bread',        11.29, 'Dining',         '2026-04-08', 'Lunch'),
    (uid, 'huntington', 'Kroger',              31.18, 'Groceries',      '2026-04-08', '');

  -- ──────────────────────────────────────────────
  -- SPENDING ALERTS
  -- ──────────────────────────────────────────────
  insert into public.spending_alerts (user_id, account, threshold) values
    (uid, 'huntington', 200.00),
    (uid, 'chase',      300.00);

end $$;
