# CasaFinance — Deployment Guide
> From zero to live on your iPhone home screen

---

## Overview

CasaFinance uses three services:
- **Supabase** — Database, auth, row-level security
- **Vercel** — Frontend hosting + serverless functions (AI proxy)
- **Anthropic API** — Claude AI assistant (called only from server side)

Total monthly cost: **$0** (all free tiers) + your existing Claude API usage.

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create account)
2. Click **New Project**
3. Settings:
   - **Name:** `casafinance`
   - **Database Password:** Generate a strong one and save it
   - **Region:** US East (closest to Ohio)
4. Wait for project to provision (~2 minutes)
5. Once ready, go to **Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `anon / public` key → this is your `SUPABASE_ANON_KEY`
   - `service_role` key → this is your `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## Step 2: Run the Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Click **New Query**
3. Paste the entire contents of `supabase/001_initial_schema.sql`
4. Click **Run** — you should see "Success. No rows returned."
5. Verify: Go to **Table Editor** — you should see tables: `profiles`, `bills`, `bill_payments`, `debt_accounts`, `debt_payments`, `ai_summaries`

## Step 3: Create Your Account

You'll create your account through the app after deploying, but if you want to seed data first:

1. Go to **Authentication → Users** in Supabase
2. Click **Add User → Create New User**
3. Enter your email and a password
4. Check "Auto Confirm User"
5. Click **Create User**
6. Copy the `User UID` from the user list

## Step 4: Seed Your Financial Data

1. Go to **SQL Editor → New Query**
2. Paste the contents of `supabase/002_seed_data.sql`
3. Replace `YOUR_USER_UUID_HERE` with your actual User UID from Step 3
4. Click **Run**
5. Verify: Go to **Table Editor → bills** — you should see all 18 bills
6. Check **Table Editor → debt_accounts** — you should see all 6 cards

## Step 5: Get Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to **API Keys**
3. Create a new key named `casafinance`
4. Copy the key (starts with `sk-ant-`)
5. Save it securely — you'll need it for Vercel

## Step 6: Deploy to Vercel

### Option A: Via GitHub (Recommended)

1. Push the `casafinance-app` folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click **Add New → Project**
4. Import your GitHub repo
5. Vercel auto-detects Vite — leave defaults
6. Add **Environment Variables** before deploying:

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | All |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | All |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | All |
| `SUPABASE_ANON_KEY` | Your anon key | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | All |
| `CASAFINANCE` | `sk-ant-...` | All |
| `ALLOWED_ORIGIN` | `https://your-project.vercel.app` | All |

7. Click **Deploy**

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# From the casafinance-app directory
cd casafinance-app
npm install
vercel

# Follow prompts, then set env vars:
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add CASAFINANCE
vercel env add ALLOWED_ORIGIN

# Redeploy with env vars
vercel --prod
```

## Step 7: Connect Your Custom Domain (Optional)

1. Purchase `casafinance.app` from your preferred registrar
2. In Vercel: **Settings → Domains → Add Domain**
3. Enter `casafinance.app`
4. Add the DNS records Vercel provides to your registrar
5. Wait for SSL certificate (automatic, ~10 minutes)
6. Update `ALLOWED_ORIGIN` env var to `https://casafinance.app`

## Step 8: Add to iPhone Home Screen

1. Open Safari on your iPhone
2. Navigate to your Vercel URL (or casafinance.app)
3. Tap the **Share** button (box with arrow)
4. Scroll down and tap **Add to Home Screen**
5. Name it "CasaFinance" and tap **Add**
6. The app icon appears on your home screen — opens in standalone mode (no browser chrome)

## Step 9: Configure Supabase Auth (Important)

1. In Supabase: **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel deployment URL
3. Add your Vercel URL to **Redirect URLs**
4. If using a custom domain, add that too

---

## Security Checklist

- [x] RLS enabled on ALL tables
- [x] All policies scoped to `auth.uid()`
- [x] Anthropic API key only in Vercel env vars (server-side)
- [x] Supabase service role key only in serverless functions
- [x] Only anon key exposed client-side (safe by design)
- [x] Auth token validated in every serverless function
- [x] HTTPS enforced by Vercel
- [x] CORS restricted to your domain

---

## Troubleshooting

**"Invalid session" when using AI chat**
→ Sign out and sign back in. Your session token may have expired.

**Bills not showing after seed**
→ Double-check the user UUID in the seed script matches your auth user.

**AI responses are slow**
→ Normal — Claude API calls take 2-5 seconds. The serverless function adds ~200ms.

**PWA not working on iPhone**
→ Must use Safari (not Chrome) to add to home screen. iOS only supports PWAs via Safari.

**"Failed to fetch" errors**
→ Check that environment variables are set in Vercel (not just locally).

---

## File Structure Reference

```
casafinance-app/
├── api/                          # Vercel serverless functions
│   ├── ai-chat.js                # AI assistant proxy
│   └── monthly-summary.js        # Monthly report generator
├── public/
│   ├── manifest.json             # PWA manifest
│   └── sw.js                     # Service worker
├── src/
│   ├── hooks/
│   │   ├── useAuth.jsx           # Auth context + provider
│   │   └── useData.js            # Bills, payments, debts CRUD
│   ├── lib/
│   │   └── supabase.js           # Supabase client
│   ├── pages/
│   │   ├── AuthPage.jsx          # Login / signup
│   │   └── CasaFinance.jsx       # Main app (all 4 tabs)
│   ├── App.jsx                   # Root with auth routing
│   └── main.jsx                  # Entry point
├── supabase/
│   ├── 001_initial_schema.sql    # Full schema + RLS
│   └── 002_seed_data.sql         # Gian's real financial data
├── .env.example                  # Environment variable template
├── index.html                    # HTML with PWA meta tags
├── package.json
├── vercel.json                   # Vercel config
└── vite.config.js
```

---

## What's Live After Deployment

✅ Login/signup with persistent sessions
✅ All 18 bills pre-loaded with real amounts and due dates
✅ All 6 debt accounts with balances, APRs, and attack phases
✅ Bill payment tracking with undo
✅ Debt balance updates with celebration on elimination
✅ AI assistant powered by Claude (via secure serverless proxy)
✅ PWA — saves to iPhone home screen
✅ Monthly auto-reset ready (bills carry over, payments reset)
✅ Row-level security — data isolated per user

---

*Built for Gian. Powered by la cultura. ¡Vamos!* 🏠
