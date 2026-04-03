// /api/process-receipt.js — Vercel Serverless Function
// Uses Claude vision to extract transaction data from receipt screenshots.

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

  const { imageBase64, mediaType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 required' });
  }

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
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Extract transaction details from this receipt or purchase screenshot. Return ONLY valid JSON with these fields:
{
  "merchant": "Store or business name",
  "amount": 12.34,
  "date": "YYYY-MM-DD",
  "category": "One of: Groceries, Dining, Gas, Shopping, Entertainment, Transportation, Health, Home, Utilities, Subscription, Other"
}

Rules:
- amount must be a number (no $ sign)
- date must be YYYY-MM-DD format. If you can't determine the year, use the current year.
- If a field cannot be determined, use null
- Pick the most specific category that fits`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || '';

    // Parse the JSON from Claude's response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (extracted) {
        // Normalize amount to number
        if (typeof extracted.amount === 'string') {
          extracted.amount = parseFloat(extracted.amount.replace(/[$,]/g, ''));
        }
        return res.status(200).json({ data: extracted });
      }

      return res.status(200).json({ data: { merchant: null, amount: null, date: null, category: 'Other' }, raw: text });
    } catch {
      return res.status(200).json({ data: { merchant: null, amount: null, date: null, category: 'Other' }, raw: text });
    }
  } catch (error) {
    console.error('Receipt processing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
