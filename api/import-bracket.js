// api/import-bracket.js
// Fetches the NCAA tournament bracket from ESPN server-side (avoids browser CORS block).
// Returns teams organized by region with seeds, ESPN IDs, and primary team colors.
// Only works when the tournament bracket is published (late March each year).

const REGIONS = ['East', 'West', 'South', 'Midwest'];

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; March-Madness-App/1.0)',
    },
  });
  if (!res.ok) throw new Error(`ESPN returned HTTP ${res.status} for ${url}`);
  return res.json();
}

// Fetch primary and alternate color for one ESPN team ID.
async function fetchTeamColor(teamId) {
  try {
    const data = await fetchJSON(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}`
    );
    return {
      color: data.team?.color || null,
      alternateColor: data.team?.alternateColor || null,
    };
  } catch {
    return { color: null, alternateColor: null };
  }
}

// Parse whatever ESPN gives us for the bracket into { East:[], West:[], South:[], Midwest:[] }.
// ESPN's bracket shape varies — try a few known structures before giving up.
function parseBracketShape(data) {
  // Shape A: { bracket: { groups: [{ name, seeds: [{ seed, team:{id,displayName,color} }] }] } }
  const groupsA = data?.bracket?.groups;
  if (Array.isArray(groupsA) && groupsA.length) return parseGroups(groupsA);

  // Shape B: { groups: [...] } (older response)
  const groupsB = data?.groups;
  if (Array.isArray(groupsB) && groupsB.length) return parseGroups(groupsB);

  // Shape C: { rounds: [{ games: [{ competitors:[{seed,team}], group:{name} }] }] }
  const rounds = data?.rounds || data?.bracket?.rounds;
  if (Array.isArray(rounds) && rounds.length) {
    const firstRound = rounds.find(r =>
      (r.displayName || r.name || '').toLowerCase().includes('first') ||
      r.id === 1 || r.number === 1
    ) || rounds[0];
    const games = firstRound?.games || firstRound?.competitions || [];
    if (games.length) return parseGames(games);
  }

  return null;
}

function normalizeRegion(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('east'))    return 'East';
  if (n.includes('west'))    return 'West';
  if (n.includes('south'))   return 'South';
  if (n.includes('midwest')) return 'Midwest';
  return null;
}

function parseGroups(groups) {
  const roster = { East: [], West: [], South: [], Midwest: [] };
  for (const group of groups) {
    const region = normalizeRegion(group.name || group.displayName);
    if (!region) continue;
    const seeds = group.seeds || group.participants || group.teams || [];
    for (const entry of seeds) {
      const team = entry.team || entry;
      roster[region].push({
        seed:           parseInt(entry.seed || team.seed) || 0,
        name:           team.shortDisplayName || team.displayName || team.name || '',
        espnId:         String(team.id || ''),
        firstFour:      false,
        color:          team.color || null,
        alternateColor: team.alternateColor || null,
      });
    }
    roster[region].sort((a, b) => a.seed - b.seed);
  }
  return roster;
}

function parseGames(games) {
  const roster = { East: [], West: [], South: [], Midwest: [] };
  for (const game of games) {
    const region = normalizeRegion(
      game.group?.name || game.group?.displayName || game.bracketRegion
    );
    if (!region) continue;
    const competitors = game.competitors || game.participants || [];
    for (const comp of competitors) {
      const team = comp.team || comp;
      roster[region].push({
        seed:           parseInt(comp.seed || team.seed) || 0,
        name:           team.shortDisplayName || team.displayName || team.name || '',
        espnId:         String(team.id || ''),
        firstFour:      false,
        color:          team.color || null,
        alternateColor: team.alternateColor || null,
      });
    }
  }
  for (const r of REGIONS) roster[r].sort((a, b) => a.seed - b.seed);
  return roster;
}

// Batch-fetch colors for teams that don't have them, 8 at a time.
async function enrichWithColors(roster) {
  const needsColor = Object.values(roster).flat().filter(t => t.espnId && !t.color);
  if (!needsColor.length) return roster;

  const colorMap = {};
  for (let i = 0; i < needsColor.length; i += 8) {
    const chunk = needsColor.slice(i, i + 8);
    const results = await Promise.all(chunk.map(t => fetchTeamColor(t.espnId)));
    chunk.forEach((t, j) => { colorMap[t.espnId] = results[j]; });
  }

  const enriched = {};
  for (const region of REGIONS) {
    enriched[region] = roster[region].map(t => ({
      ...t,
      color:          t.color          || colorMap[t.espnId]?.color          || null,
      alternateColor: t.alternateColor || colorMap[t.espnId]?.alternateColor || null,
    }));
  }
  return enriched;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Step 1: Get tournament list to find the current NCAA tournament ID.
    const tourneyList = await fetchJSON(
      'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments'
    );
    const items = tourneyList.items || tourneyList.tournaments || [];
    const ncaa  = items.find(t =>
      (t.name || '').toLowerCase().includes('ncaa') ||
      (t.type || '') === 'ncaab_bracket'
    ) || items[0];

    if (!ncaa) {
      return res.json({
        success: false,
        error: 'No active NCAA tournament found on ESPN. The bracket is usually published on Selection Sunday in mid-March. Use CSV import until then.',
      });
    }

    // Step 2: Fetch bracket data. Try the tournament's $ref first, then a direct URL.
    const tourneyId  = ncaa.id || ncaa.$ref?.match(/tournaments\/(\d+)/)?.[1];
    const refUrl     = ncaa.$ref || ncaa.href;
    let bracketData  = null;
    let lastError    = '';

    const attempts = [
      refUrl,
      tourneyId && `https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments/${tourneyId}`,
      tourneyId && `https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/tournaments/${tourneyId}`,
    ].filter(Boolean);

    for (const url of attempts) {
      try {
        bracketData = await fetchJSON(url);
        break;
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!bracketData) {
      return res.json({
        success: false,
        error: `Could not fetch bracket data from ESPN. ${lastError}. Use CSV import.`,
      });
    }

    // Step 3: Parse into our { East, West, South, Midwest } format.
    const roster = parseBracketShape(bracketData);
    if (!roster) {
      return res.json({
        success: false,
        error: 'ESPN returned bracket data but in an unexpected format. The bracket may not be finalized yet. Use CSV import.',
      });
    }

    const totalTeams = Object.values(roster).reduce((s, r) => s + r.length, 0);
    if (totalTeams < 60) {
      return res.json({
        success: false,
        error: `Only found ${totalTeams} teams (expected 64). The bracket may not be fully announced yet. Use CSV import.`,
      });
    }

    // Step 4: Enrich with team colors.
    const enriched = await enrichWithColors(roster);

    return res.json({ success: true, roster: enriched, teamCount: totalTeams });
  } catch (err) {
    return res.json({
      success: false,
      error: `ESPN import failed: ${err.message}. Use CSV import to load teams manually.`,
    });
  }
}
