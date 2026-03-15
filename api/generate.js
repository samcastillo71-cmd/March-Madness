// api/generate.js — Vercel serverless proxy for Claude Haiku
// ANTHROPIC_KEY is set in Vercel environment variables (server-side only).
// This keeps the key out of the client bundle entirely.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_KEY not configured on server' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' });
  }

  if (prompt.length > 8000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  let claudeRes;
  try {
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return res.status(502).json({ error: 'Failed to reach Anthropic API: ' + e.message });
  }

  // Pass 429 through so client retry logic works
  if (claudeRes.status === 429) {
    let body = '';
    try { body = await claudeRes.text(); } catch {}
    const isDaily = body.toLowerCase().includes('daily') || body.toLowerCase().includes('credit');
    res.status(429);
    return res.json({
      error: isDaily
        ? 'Daily Claude quota reached. Try again tomorrow.'
        : 'Rate limited — too many requests.',
    });
  }

  if (!claudeRes.ok) {
    const errText = await claudeRes.text().catch(() => '');
    return res.status(claudeRes.status).json({
      error: `Claude API error ${claudeRes.status}: ${errText.slice(0, 500)}`,
    });
  }

  let data;
  try {
    data = await claudeRes.json();
  } catch {
    return res.status(502).json({ error: 'Claude returned invalid JSON' });
  }

  // Claude returns content as an array of blocks
  const text = data.content?.[0]?.text || '{}';
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    console.warn('Claude JSON parse failed:', text.slice(0, 200));
    parsed = null;
  }

  return res.status(200).json({ result: parsed });
}
