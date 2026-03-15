// api/gemini.js — Vercel serverless proxy for Gemini API
// The GEMINI_KEY environment variable is set in Vercel dashboard (server-side only).
// This keeps the key out of the client bundle entirely.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_KEY not configured on server' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' });
  }

  // Cap prompt length to prevent abuse
  if (prompt.length > 8000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
  } catch (e) {
    return res.status(502).json({ error: 'Failed to reach Gemini API: ' + e.message });
  }

  // Pass 429 through so the client retry logic works
  if (geminiRes.status === 429) {
    let body = '';
    try { body = await geminiRes.text(); } catch {}
    const isDaily =
      body.toLowerCase().includes('quota') && body.toLowerCase().includes('day');
    res.status(429);
    return res.json({
      error: isDaily
        ? 'Daily Gemini quota reached. Resets at midnight Pacific. Try again tomorrow.'
        : 'Rate limited — too many requests.',
    });
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => '');
    return res.status(geminiRes.status).json({
      error: `Gemini API error ${geminiRes.status}: ${errText.slice(0, 200)}`,
    });
  }

  let data;
  try {
    data = await geminiRes.json();
  } catch {
    return res.status(502).json({ error: 'Gemini returned invalid JSON' });
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    console.warn('Gemini JSON parse failed:', text.slice(0, 200));
    parsed = null;
  }

  return res.status(200).json({ result: parsed });
}
