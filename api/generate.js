// api/generate.js — Vercel serverless proxy for Gemini API
// GEMINI_KEY is set in Vercel environment variables (server-side only).
// To switch to Claude: swap this file with the Claude version and set ANTHROPIC_KEY in Vercel.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    console.log('[generate] ERROR: GEMINI_KEY not set');
    return res.status(500).json({ error: 'GEMINI_KEY not configured on server' });
  }

  // Explicitly parse body — handles both pre-parsed object and raw string
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }

  const { prompt } = body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    console.log('[generate] ERROR: missing prompt. body type:', typeof body, 'keys:', Object.keys(body || {}));
    return res.status(400).json({ error: 'Missing or invalid prompt' });
  }

  if (prompt.length > 8000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  console.log('[generate] Calling Gemini 2.0 Flash, prompt length:', prompt.length);

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
    console.log('[generate] Network error:', e.message);
    return res.status(502).json({ error: 'Failed to reach Gemini API: ' + e.message });
  }

  const rawBody = await geminiRes.text();
  console.log('[generate] Gemini status:', geminiRes.status, '| body:', rawBody.slice(0, 500));

  if (geminiRes.status === 429) {
    // Distinguish daily quota (RESOURCE_EXHAUSTED) from per-minute rate limit (RATE_LIMIT_EXCEEDED)
    const isDaily = rawBody.includes('RESOURCE_EXHAUSTED') ||
      (rawBody.toLowerCase().includes('quota') && rawBody.toLowerCase().includes('day'));
    res.status(429);
    return res.json({
      error: isDaily
        ? 'Daily Gemini quota reached. Resets at midnight Pacific. Try again tomorrow.'
        : 'Rate limited — too many requests.',
    });
  }

  if (!geminiRes.ok) {
    return res.status(geminiRes.status).json({
      error: `Gemini API error ${geminiRes.status}: ${rawBody.slice(0, 500)}`,
    });
  }

  let data;
  try { data = JSON.parse(rawBody); }
  catch {
    console.log('[generate] Failed to parse Gemini response as JSON');
    return res.status(502).json({ error: 'Gemini returned invalid JSON' });
  }

  // Extract text from Gemini response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  // Aggressively clean the response — Gemini sometimes adds text before/after JSON
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  // Find the first { and last } to extract just the JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace  = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.log('[generate] Failed to parse result as JSON:', cleaned.slice(0, 200));
    parsed = null;
  }

  console.log('[generate] Success, result keys:', parsed ? Object.keys(parsed) : 'null');
  return res.status(200).json({ result: parsed });
}
