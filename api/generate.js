// api/generate.js — Vercel serverless proxy for Claude Haiku
// ANTHROPIC_KEY is set in Vercel environment variables (server-side only).
// To switch to Gemini: swap this file with the Gemini version and set GEMINI_KEY in Vercel.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    console.log('[generate] ERROR: ANTHROPIC_KEY not set');
    return res.status(500).json({ error: 'ANTHROPIC_KEY not configured on server' });
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

  // Try models in order — first available wins
  // claude-3-haiku-20240307 is the guaranteed fallback available on all paid accounts
  const MODELS = [
    'claude-haiku-4-5-20251001',
    'claude-haiku-4-5',
    'claude-3-5-haiku-20241022',
    'claude-3-haiku-20240307',
  ];

  for (const model of MODELS) {
    console.log('[generate] Trying model:', model, '| prompt length:', prompt.length);

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
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (e) {
      console.log('[generate] Network error:', e.message);
      return res.status(502).json({ error: 'Failed to reach Anthropic API: ' + e.message });
    }

    const rawBody = await claudeRes.text();
    console.log('[generate] Model:', model, '| Status:', claudeRes.status, '| body:', rawBody.slice(0, 500));

    // Credit/billing error — fatal, stop immediately
    if (claudeRes.status === 400 || claudeRes.status === 402) {
      let errData;
      try { errData = JSON.parse(rawBody); } catch {}
      const msg = errData?.error?.message || rawBody;
      if (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('billing')) {
        return res.status(402).json({
          error: 'Claude credit balance too low. Go to console.anthropic.com to add credits.',
        });
      }
      // Model not found or invalid model — try next
      if (
        msg.toLowerCase().includes('model') ||
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('invalid')
      ) {
        console.log('[generate] Model issue, trying next...');
        continue;
      }
      // Other 400 — real error, return it
      return res.status(400).json({ error: `Claude API error 400: ${msg.slice(0, 500)}` });
    }

    // Model not found
    if (claudeRes.status === 404) {
      console.log('[generate] Model not found, trying next...');
      continue;
    }

    // Rate limit
    if (claudeRes.status === 429) {
      const isCredit = rawBody.toLowerCase().includes('credit') || rawBody.toLowerCase().includes('billing');
      res.status(429);
      return res.json({
        error: isCredit
          ? 'Claude credit balance too low. Go to console.anthropic.com to add credits.'
          : 'Rate limited — too many requests.',
      });
    }

    if (!claudeRes.ok) {
      return res.status(claudeRes.status).json({
        error: `Claude API error ${claudeRes.status}: ${rawBody.slice(0, 500)}`,
      });
    }

    // Success — parse response
    let data;
    try { data = JSON.parse(rawBody); }
    catch {
      console.log('[generate] Failed to parse Claude response as JSON');
      return res.status(502).json({ error: 'Claude returned invalid JSON' });
    }

    const text = data.content?.[0]?.text || '{}';

    // Aggressively clean — find first { and last } to extract just the JSON object
    let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
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

    console.log('[generate] Success with model:', model, '| result keys:', parsed ? Object.keys(parsed) : 'null');
    return res.status(200).json({ result: parsed });
  }

  // All models failed
  console.log('[generate] All models exhausted');
  return res.status(400).json({
    error: 'No available Claude model found. Check your API key at console.anthropic.com.',
  });
}
