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
// Correct v2 flow per https://www.phylopic.org/articles/api-recipes:
// 1. Get build number from root
// 2. Use autocomplete to get a valid name string PhyloPic recognises
// 3. Use that name as filter_name to /nodes with embed_primaryImage
// 4. Construct SVG URL from image UUID
async function fetchPhyloPic(latinName) {
  try {
    // Step 1: get current build number
    const rootRes = await fetch('https://api.phylopic.org', {
      headers: { 'Accept': 'application/vnd.phylopic.v2+json' }
    });
    if (!rootRes.ok) return null;
    const rootData = await rootRes.json();
    const build = rootData?.build;
    if (!build) { console.log('[PhyloPic] No build number'); return null; }

    // Step 2: autocomplete to find a name PhyloPic recognises
    // Use genus only first (more likely to match), then full name
    const genus = latinName.split(' ')[0];
    const autoRes = await fetch(`https://api.phylopic.org/autocomplete?query=${encodeURIComponent(latinName.toLowerCase().replace(/[^a-z ]/g,'').trim())}`);
    let filterName = latinName;
    if (autoRes.ok) {
      const suggestions = await autoRes.json();
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        // Find best match — prefer exact or starts with genus
        const best = suggestions.find(s => s.toLowerCase().startsWith(genus.toLowerCase()))
          || suggestions[0];
        filterName = best;
      }
    }

    // Step 3: search nodes with filter_name, embed primary image
    const nodesRes = await fetch(
      `https://api.phylopic.org/nodes?build=${build}&filter_name=${encodeURIComponent(filterName)}&embed_items=true&embed_primaryImage=true&page=0`,
      { headers: { 'Accept': 'application/vnd.phylopic.v2+json' } }
    );
    if (nodesRes.status === 404) {
      // No nodes found — try genus only
      const genusRes = await fetch(
        `https://api.phylopic.org/nodes?build=${build}&filter_name=${encodeURIComponent(genus.toLowerCase())}&embed_items=true&embed_primaryImage=true&page=0`,
        { headers: { 'Accept': 'application/vnd.phylopic.v2+json' } }
      );
      if (!genusRes.ok) return null;
      const genusData = await genusRes.json();
      const genusItems = genusData?._embedded?.items || [];
      for (const item of genusItems) {
        const uuid = item?._embedded?.primaryImage?.uuid;
        if (uuid) return `https://images.phylopic.org/images/${uuid}/vector.svg`;
      }
      return null;
    }
    if (!nodesRes.ok) return null;
    const nodesData = await nodesRes.json();
    const items = nodesData?._embedded?.items || [];
    for (const item of items) {
      const uuid = item?._embedded?.primaryImage?.uuid;
      if (uuid) {
        console.log('[PhyloPic] Found silhouette for:', latinName, 'uuid:', uuid);
        return `https://images.phylopic.org/images/${uuid}/vector.svg`;
      }
    }
    return null;
  } catch (e) {
    console.log('[PhyloPic] Error:', e.message);
    return null;
  }
}

// ── Fetch Wikipedia thumbnail — try Latin name, then search for common name ──
async function fetchWikipediaImage(latinName, commonName) {
  // Try Latin name directly first
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(latinName)}`);
    if (res.ok) {
      const data = await res.json();
      const img = data?.thumbnail?.source || data?.originalimage?.source;
      if (img) return img;
    }
  } catch {}
  // Fallback: search Wikipedia for the term and get the top result's image
  if (commonName) {
    try {
      const searchRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(commonName)}`);
      if (searchRes.ok) {
        const data = await searchRes.json();
        return data?.thumbnail?.source || data?.originalimage?.source || null;
      }
    } catch {}
  }
  return null;
}

// ── Fetch iNaturalist photos ─────────────────────────────────────────────────
async function fetchINaturalistImages(latinName, count = 2) {
  try {
    // Search by exact scientific name using the taxon_name parameter
    // This is more precise than q= but iNat still sometimes returns wrong results
    // so we verify the genus matches
    const genus   = latinName.split(' ')[0].toLowerCase();
    const species = latinName.split(' ')[1]?.toLowerCase() || '';

    const res = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latinName)}&rank=species&per_page=5`
    );
    if (!res.ok) return [];
    const data = await res.json();

    // Find the result whose scientific name exactly matches
    const taxon = (data?.results || []).find(t => {
      const name = (t.name || '').toLowerCase();
      return name === latinName.toLowerCase() ||
             (name.startsWith(genus) && species && name.includes(species));
    });

    if (!taxon) {
      console.log('[iNat] No exact match for:', latinName, '— results:', (data?.results || []).map(t => t.name));
      return [];
    }

    console.log('[iNat] Matched taxon:', taxon.name, 'for search:', latinName);
    const photos = taxon.taxon_photos?.slice(0, count) || [];
    return photos
      .map(p => p?.photo?.medium_url || p?.photo?.url)
      .filter(Boolean)
      .map(url => ({ url, source: 'iNaturalist' }));
  } catch (e) {
    console.log('[iNat] Error:', e.message);
    return [];
  }
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
    const [phyloPicUrl, wikiImageUrl, inatImages, wikiMediaImg] = await Promise.all([
      fetchPhyloPic(fetchLatinName),
      fetchWikipediaImage(fetchLatinName, fetchLatinName),
      fetchINaturalistImages(fetchLatinName, 2),
      fetchWikimediaImage(fetchLatinName),
    ]);
    const gallery = [];
    if (wikiImageUrl) gallery.push({ url: wikiImageUrl, source: 'Wikipedia' });
    inatImages.forEach(img => gallery.push(img));
    if (wikiMediaImg) gallery.push(wikiMediaImg);
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

    const [phyloPicUrl, wikiImageUrl, inatImages, wikiMediaImg] = await Promise.all([
      fetchPhyloPic(latin),
      fetchWikipediaImage(latin, latin),
      fetchINaturalistImages(latin, 2),
      fetchWikimediaImage(latin),
    ]);

    parsed.phyloPicUrl  = phyloPicUrl  || null;
    parsed.wikiImageUrl = wikiImageUrl || null;

    // Build gallery from Wikipedia + iNaturalist + Wikimedia Commons
    const gallery = [];
    if (wikiImageUrl) gallery.push({ url: wikiImageUrl, source: 'Wikipedia' });
    inatImages.forEach(img => gallery.push(img));
    if (wikiMediaImg) gallery.push(wikiMediaImg);

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
