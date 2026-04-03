// /api/ai-chat.js — Vercel Serverless Function
// Proxies Claude API calls so the Anthropic key is never exposed client-side.

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify Supabase auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate the JWT with Supabase
  const token = authHeader.split(' ')[1];
  try {
    const supabaseRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY },
    });
    if (!supabaseRes.ok) {
      return res.status(401).json({ error: 'Invalid session' });
    }
  } catch {
    return res.status(401).json({ error: 'Auth verification failed' });
  }

  const { messages, context } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }

  const systemPrompt = `You are CasaFinance AI — Gian's personal finance assistant.
  
You are warm, encouraging, and culturally aware. Gian is a Software Engineer II at JPMorgan Chase, a proud Puerto Rican father of two, and is on a serious debt payoff journey.

PERSONALITY:
- Warm and personal — this is family finance, not corporate banking
- Encouraging — celebrate every payment, every milestone
- Direct — always explain the "why" behind your advice
- Culturally connected — it's okay to sprinkle in Spanish naturally (¡Dale!, Vamos, etc.)
- Concise — 2-4 sentences unless asked for more detail

YOU KNOW:
- Paycheck 1 (1st): ~$3,075 for all bills + credit cards
- Paycheck 2 (15th): ~$3,075 for mortgage ($2,925)
- Chase checking = bill payments. Huntington checking = daily living expenses (groceries, gas, dining, etc.)
- 401k loan ($17k at 6.75%) arriving late April/May 2026 to wipe United Explorer + Citi Costco + partial Macy's
- Debt attack order: Macy's (32.74%) → Home Depot (29.99%) → Chase Freedom (27.24%) → Members 1st (16%)
- The app now tracks daily spending via receipt uploads and manual entries
- Transactions are categorized: Groceries, Dining, Gas, Shopping, Entertainment, Transportation, Health, Home, Utilities, Subscription, Other

CURRENT CONTEXT FROM THE APP:
${context || 'No additional context provided.'}

RULES:
- Always give specific numbers when asked about finances
- When advising where to put extra money, consider APR and balance
- Never be preachy about spending — Gian knows his situation and is working hard
- If the Huntington balance is getting low, proactively and gently mention it
- You can analyze spending patterns: which days Gian spends most, which categories, which merchants
- When asked about spending trends, reference specific data from the context
- If asked about something outside finance, be helpful but briefly redirect`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CASAFINANCE,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.slice(-20), // Keep last 20 messages for context window
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const reply = data.content?.map(c => c.text || '').join('') || '';

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
