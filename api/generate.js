// api/generate.js — Vercel serverless proxy for Claude Haiku
// ANTHROPIC_KEY is set in Vercel environment variables (server-side only).
// Handles: source fetching, Claude generation, image fetching (PhyloPic, Wikipedia, iNaturalist, Wikimedia, GBIF)

// ── Fetch a URL and return plain text, best-effort ──────────────────────────
async function fetchSourceText(url, maxChars = 3000) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarchMadnessApp/1.0)' } });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    let text = '';
    if (contentType.includes('text')) {
      text = await res.text();
      // Strip HTML tags if it's HTML
      if (contentType.includes('html')) {
        text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
                   .replace(/<style[\s\S]*?<\/style>/gi, '')
                   .replace(/<[^>]+>/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim();
      }
    }
    return text.slice(0, maxChars) || null;
  } catch { return null; }
}

// ── Fetch PhyloPic silhouette URL for a Latin name ───────────────────────────
async function fetchPhyloPic(latinName) {
  try {
    const search = await fetch(`https://api.phylopic.org/autocomplete?query=${encodeURIComponent(latinName)}`);
    if (!search.ok) return null;
    const data = await search.json();
    const uuid = data?.[0]?.uuid;
    if (!uuid) return null;
    const node = await fetch(`https://api.phylopic.org/nodes/${uuid}?embed_primaryImage=true`);
    if (!node.ok) return null;
    const nodeData = await node.json();
    const imgUuid = nodeData?._embedded?.primaryImage?.uuid;
    if (!imgUuid) return null;
    // Use SVG for clean silhouette
    return `https://images.phylopic.org/images/${imgUuid}/vector.svg`;
  } catch { return null; }
}

// ── Fetch Wikipedia thumbnail for a Latin name ──────────────────────────────
async function fetchWikipediaImage(latinName) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(latinName)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch { return null; }
}

// ── Fetch iNaturalist photos ─────────────────────────────────────────────────
async function fetchINaturalistImages(latinName, count = 2) {
  try {
    const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latinName)}&rank=species&per_page=1`);
    if (!res.ok) return [];
    const data = await res.json();
    const taxon = data?.results?.[0];
    if (!taxon) return [];
    const photos = taxon.taxon_photos?.slice(0, count) || [];
    return photos
      .map(p => p?.photo?.medium_url || p?.photo?.url)
      .filter(Boolean)
      .map(url => ({ url, source: 'iNaturalist' }));
  } catch { return []; }
}

// ── Fetch Wikimedia Commons image ────────────────────────────────────────────
async function fetchWikimediaImage(latinName) {
  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(latinName)}&prop=pageimages&format=json&pithumbsize=400&origin=*`);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    const thumb = pages[0]?.thumbnail?.source;
    return thumb ? { url: thumb, source: 'Wikimedia Commons' } : null;
  } catch { return null; }
}

// ── Fetch GBIF image ─────────────────────────────────────────────────────────
async function fetchGBIFImage(latinName) {
  try {
    const search = await fetch(`https://api.gbif.org/v1/species?name=${encodeURIComponent(latinName)}&limit=1`);
    if (!search.ok) return null;
    const sData = await search.json();
    const key = sData?.results?.[0]?.key;
    if (!key) return null;
    const media = await fetch(`https://api.gbif.org/v1/species/${key}/media?limit=3&type=StillImage`);
    if (!media.ok) return null;
    const mData = await media.json();
    const img = mData?.results?.find(r => r.identifier && (r.identifier.includes('.jpg') || r.identifier.includes('.jpeg') || r.identifier.includes('.png')));
    return img ? { url: img.identifier, source: 'GBIF' } : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    console.log('[generate] ERROR: ANTHROPIC_KEY not set');
    return res.status(500).json({ error: 'ANTHROPIC_KEY not configured on server' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }

  const { prompt, sources = [], textOnly = false, fetchImagesOnly = false, latinName: fetchLatinName } = body || {};

  // ── fetchImagesOnly mode: skip Claude, just fetch images for a given Latin name ──
  if (fetchImagesOnly && fetchLatinName) {
    console.log('[generate] fetchImagesOnly mode for:', fetchLatinName);
    const [phyloPicUrl, wikiImageUrl, inatImages, wikiMediaImg, gbifImg] = await Promise.all([
      fetchPhyloPic(fetchLatinName),
      fetchWikipediaImage(fetchLatinName),
      fetchINaturalistImages(fetchLatinName, 2),
      fetchWikimediaImage(fetchLatinName),
      fetchGBIFImage(fetchLatinName),
    ]);
    const gallery = [];
    inatImages.forEach(img => gallery.push(img));
    if (wikiMediaImg) gallery.push(wikiMediaImg);
    if (gbifImg)      gallery.push(gbifImg);
    if (wikiImageUrl) gallery.unshift({ url: wikiImageUrl, source: 'Wikipedia' });
    return res.status(200).json({ result: { phyloPicUrl: phyloPicUrl || null, wikiImageUrl: wikiImageUrl || null, galleryImages: gallery } });
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    console.log('[generate] ERROR: missing prompt');
    return res.status(400).json({ error: 'Missing or invalid prompt' });
  }

  if (prompt.length > 8000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  // ── Fetch source content ──────────────────────────────────────────────────
  let sourceContext = '';
  if (sources.length > 0) {
    const primary   = sources.filter(s => s.primary);
    const secondary = sources.filter(s => !s.primary);

    for (const src of primary) {
      // Convert Google Slides edit URL to export/txt URL
      let fetchUrl = src.url;
      const slidesMatch = fetchUrl.match(/\/presentation\/d\/([^/]+)/);
      if (slidesMatch) {
        fetchUrl = `https://docs.google.com/presentation/d/${slidesMatch[1]}/export/txt`;
      }
      const text = await fetchSourceText(fetchUrl, 4000);
      if (text) {
        sourceContext += `\n\n=== PRIMARY SOURCE: ${src.name} ===\n${text}`;
      }
    }
    for (const src of secondary) {
      let fetchUrl = src.url;
      const slidesMatch = fetchUrl.match(/\/presentation\/d\/([^/]+)/);
      if (slidesMatch) {
        fetchUrl = `https://docs.google.com/presentation/d/${slidesMatch[1]}/export/txt`;
      }
      const text = await fetchSourceText(fetchUrl, 2000);
      if (text) {
        sourceContext += `\n\n=== SECONDARY SOURCE: ${src.name} ===\n${text}`;
      }
    }
  }

  // Prepend source context to prompt
  const fullPrompt = sourceContext
    ? `The following reference materials have been provided. Prioritize information from PRIMARY SOURCES. Use SECONDARY SOURCES as supplementary context. Fill any remaining gaps with your own knowledge.\n${sourceContext}\n\n---\n\n${prompt}`
    : prompt;

  console.log('[generate] Calling Claude, prompt length:', fullPrompt.length, '| sources:', sources.length);

  // ── Call Claude ───────────────────────────────────────────────────────────
  const MODELS = [
    'claude-haiku-4-5-20251001',
    'claude-haiku-4-5',
    'claude-3-5-haiku-20241022',
    'claude-3-haiku-20240307',
  ];

  let parsed = null;
  for (const model of MODELS) {
    console.log('[generate] Trying model:', model);
    let claudeRes;
    try {
      claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: fullPrompt }] }),
      });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to reach Anthropic API: ' + e.message });
    }

    const rawBody = await claudeRes.text();
    console.log('[generate] Model:', model, '| Status:', claudeRes.status, '| body preview:', rawBody.slice(0, 200));

    if (claudeRes.status === 400 || claudeRes.status === 402) {
      let errData; try { errData = JSON.parse(rawBody); } catch {}
      const msg = errData?.error?.message || rawBody;
      if (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('billing')) {
        return res.status(402).json({ error: 'Claude credit balance too low. Go to console.anthropic.com to add credits.' });
      }
      if (msg.toLowerCase().includes('model') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('invalid')) {
        console.log('[generate] Model issue, trying next...');
        continue;
      }
      return res.status(400).json({ error: `Claude API error 400: ${msg.slice(0, 500)}` });
    }
    if (claudeRes.status === 404) { continue; }
    if (claudeRes.status === 429) {
      const isCredit = rawBody.toLowerCase().includes('credit') || rawBody.toLowerCase().includes('billing');
      res.status(429);
      return res.json({ error: isCredit ? 'Claude credit balance too low.' : 'Rate limited — too many requests.' });
    }
    if (!claudeRes.ok) {
      return res.status(claudeRes.status).json({ error: `Claude API error ${claudeRes.status}: ${rawBody.slice(0, 500)}` });
    }

    let data; try { data = JSON.parse(rawBody); } catch { continue; }
    const text = data.content?.[0]?.text || '{}';
    let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const fb = cleaned.indexOf('{'), lb = cleaned.lastIndexOf('}');
    if (fb !== -1 && lb > fb) cleaned = cleaned.slice(fb, lb + 1);
    try { parsed = JSON.parse(cleaned); break; }
    catch { console.log('[generate] JSON parse failed, trying next model'); continue; }
  }

  if (!parsed) {
    return res.status(500).json({ error: 'Failed to generate valid JSON from Claude' });
  }

  // ── Fetch images if Latin name is present and not textOnly mode ─────────
  if (parsed.latinName && !textOnly) {
    const latin = parsed.latinName;
    console.log('[generate] Fetching images for Latin name:', latin);

    const [phyloPicUrl, wikiImageUrl, inatImages, wikiMediaImg, gbifImg] = await Promise.all([
      fetchPhyloPic(latin),
      fetchWikipediaImage(latin),
      fetchINaturalistImages(latin, 2),
      fetchWikimediaImage(latin),
      fetchGBIFImage(latin),
    ]);

    parsed.phyloPicUrl  = phyloPicUrl  || null;
    parsed.wikiImageUrl = wikiImageUrl || null;

    // Build gallery from iNaturalist + Wikimedia + GBIF
    const gallery = [];
    inatImages.forEach(img => gallery.push(img));
    if (wikiMediaImg) gallery.push(wikiMediaImg);
    if (gbifImg)      gallery.push(gbifImg);
    // Add wiki image to gallery too if available
    if (wikiImageUrl) gallery.unshift({ url: wikiImageUrl, source: 'Wikipedia' });

    parsed.galleryImages = gallery;
    console.log('[generate] Images: phylopic=', !!phyloPicUrl, '| wiki=', !!wikiImageUrl, '| gallery=', gallery.length);
  }

  // ── Fetch ESPN images if espnId present (basketball) ─────────────────────
  if (parsed.espnId) {
    parsed.bannerUrl = `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${parsed.espnId}.png&w=900&h=225&scale=crop&location=origin&transparent=false&background=0x1a3a2a`;
    parsed.logoUrl   = `https://a.espncdn.com/i/teamlogos/ncaa/500/${parsed.espnId}.png`;
  }

  console.log('[generate] Success, result keys:', Object.keys(parsed));
  return res.status(200).json({ result: parsed });
}
