// /api/monthly-summary.js — Vercel Serverless Function
// Generates a monthly financial summary using Claude.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  // Use service role to fetch user data
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Verify user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { month, year } = req.body;

  try {
    // Fetch all data for the month
    const [billsRes, paymentsRes, debtsRes] = await Promise.all([
      supabase.from('bills').select('*').eq('user_id', user.id),
      supabase.from('bill_payments').select('*').eq('user_id', user.id).eq('month', month).eq('year', year),
      supabase.from('debt_accounts').select('*').eq('user_id', user.id),
    ]);

    const bills = billsRes.data || [];
    const payments = paymentsRes.data || [];
    const debts = debtsRes.data || [];

    const activeBills = bills.filter(b => b.is_active);
    const paidBills = payments.length;
    const totalDebt = debts.reduce((s, d) => s + parseFloat(d.current_balance), 0);

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const prompt = `Generate a warm, personal monthly financial summary for Gian.

MONTH: ${months[month]} ${year}

BILLS: ${activeBills.length} active bills
PAID: ${paidBills} of ${activeBills.length} bills paid this month
UNPAID: ${activeBills.length - paidBills}

PAYMENT DETAILS:
${payments.map(p => {
  const bill = bills.find(b => b.id === p.bill_id);
  return `- ${bill?.name || 'Unknown'}: $${p.amount_paid} on ${p.paid_date} via ${p.account_used}`;
}).join('\n')}

DEBT SNAPSHOT:
${debts.map(d => `- ${d.name}: $${d.current_balance} (${d.apr}% APR) ${d.is_eliminated ? '✓ ELIMINATED' : ''}`).join('\n')}
Total debt: $${totalDebt.toFixed(2)}

INSTRUCTIONS:
- Write 3-4 short paragraphs
- Start with how many bills paid on time
- Mention debt progress and which cards changed
- End with one encouraging note and one actionable suggestion
- Keep it warm, personal — use "Gian" by name
- If a card was eliminated, celebrate it!
- Keep it under 200 words`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CASAFINANCE,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiResponse.json();
    const summary = aiData.content?.map(c => c.text || '').join('') || 'Summary unavailable.';

    // Save to database
    await supabase.from('ai_summaries').upsert({
      user_id: user.id,
      month,
      year,
      summary_text: summary,
    }, {
      onConflict: 'user_id,year,month',
    });

    return res.status(200).json({ summary });
  } catch (error) {
    console.error('Monthly summary error:', error);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
}
