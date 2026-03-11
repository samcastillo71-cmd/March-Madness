// src/bracketData.js
// You no longer need to edit this file every year!
// Use Admin → Set Up Teams to enter teams each March.
// Research data is now stored in Firestore and auto-generated via AI.

export const CURRENT_YEAR = 2025;

// Standard NCAA seeding matchup order for Round of 64 (seed index pairs, 0-based)
// seed 1 vs 16, seed 8 vs 9, seed 5 vs 12, seed 4 vs 13, seed 6 vs 11, seed 3 vs 14, seed 7 vs 10, seed 2 vs 15
export const R64_SEED_MATCHUPS = [
  [1, 16], [8, 9], [5, 12], [4, 13],
  [6, 11], [3, 14], [7, 10], [2, 15],
];

// 2000 NCAA Tournament bracket — placeholder until admin sets up current year
export const TEAMS = {
  East: [
    { seed: 1,  name: 'Duke',            espnId: 150,  firstFour: false },
    { seed: 2,  name: 'Temple',          espnId: 218,  firstFour: false },
    { seed: 3,  name: 'Oklahoma State',  espnId: 197,  firstFour: false },
    { seed: 4,  name: 'Illinois',        espnId: 356,  firstFour: false },
    { seed: 5,  name: 'Florida',         espnId: 57,   firstFour: false },
    { seed: 6,  name: 'Indiana',         espnId: 84,   firstFour: false },
    { seed: 7,  name: 'Oregon',          espnId: 2483, firstFour: false },
    { seed: 8,  name: 'Kansas',          espnId: 2305, firstFour: false },
    { seed: 9,  name: 'DePaul',          espnId: 305,  firstFour: false },
    { seed: 10, name: 'Seton Hall',      espnId: 2550, firstFour: false },
    { seed: 11, name: 'Pepperdine',      espnId: 2502, firstFour: false },
    { seed: 12, name: 'Butler',          espnId: 2781, firstFour: false },
    { seed: 13, name: 'Penn',            espnId: 219,  firstFour: false },
    { seed: 14, name: 'Hofstra',         espnId: 2269, firstFour: false },
    { seed: 15, name: 'Lafayette',       espnId: 322,  firstFour: false },
    { seed: 16, name: 'Lamar',           espnId: 2321, firstFour: false },
  ],
  West: [
    { seed: 1,  name: 'Arizona',         espnId: 12,   firstFour: false },
    { seed: 2,  name: "St. John's",      espnId: 2599, firstFour: false },
    { seed: 3,  name: 'Oklahoma',        espnId: 201,  firstFour: false },
    { seed: 4,  name: 'LSU',             espnId: 99,   firstFour: false },
    { seed: 5,  name: 'Texas',           espnId: 251,  firstFour: false },
    { seed: 6,  name: 'Purdue',          espnId: 2509, firstFour: false },
    { seed: 7,  name: 'Louisville',      espnId: 97,   firstFour: false },
    { seed: 8,  name: 'Wisconsin',       espnId: 275,  firstFour: false },
    { seed: 9,  name: 'Fresno State',    espnId: 278,  firstFour: false },
    { seed: 10, name: 'Gonzaga',         espnId: 2250, firstFour: false },
    { seed: 11, name: 'Dayton',          espnId: 2168, firstFour: false },
    { seed: 12, name: 'Indiana State',   espnId: 282,  firstFour: false },
    { seed: 13, name: 'SE Missouri St',  espnId: 2546, firstFour: false },
    { seed: 14, name: 'Winthrop',        espnId: 2742, firstFour: false },
    { seed: 15, name: 'N. Arizona',      espnId: 2464, firstFour: false },
    { seed: 16, name: 'Jackson State',   espnId: 2296, firstFour: false },
  ],
  South: [
    { seed: 1,  name: 'Stanford',        espnId: 24,   firstFour: false },
    { seed: 2,  name: 'Cincinnati',      espnId: 2132, firstFour: false },
    { seed: 3,  name: 'Ohio State',      espnId: 194,  firstFour: false },
    { seed: 4,  name: 'Tennessee',       espnId: 2633, firstFour: false },
    { seed: 5,  name: 'Connecticut',     espnId: 41,   firstFour: false },
    { seed: 6,  name: 'Miami (FL)',      espnId: 2390, firstFour: false },
    { seed: 7,  name: 'Tulsa',           espnId: 2567, firstFour: false },
    { seed: 8,  name: 'North Carolina',  espnId: 153,  firstFour: false },
    { seed: 9,  name: 'Missouri',        espnId: 142,  firstFour: false },
    { seed: 10, name: 'Arkansas',        espnId: 8,    firstFour: false },
    { seed: 11, name: 'UNLV',            espnId: 2439, firstFour: false },
    { seed: 12, name: 'Louisiana-Laf',   espnId: 309,  firstFour: false },
    { seed: 13, name: 'Iona',            espnId: 314,  firstFour: false },
    { seed: 14, name: 'Utah State',      espnId: 328,  firstFour: false },
    { seed: 15, name: 'UNC Wilmington',  espnId: 2670, firstFour: false },
    { seed: 16, name: 'Appalachian St',  espnId: 2016, firstFour: false },
  ],
  Midwest: [
    { seed: 1,  name: 'Michigan State',  espnId: 127,  firstFour: false },
    { seed: 2,  name: 'Iowa State',      espnId: 66,   firstFour: false },
    { seed: 3,  name: 'Maryland',        espnId: 120,  firstFour: false },
    { seed: 4,  name: 'Syracuse',        espnId: 183,  firstFour: false },
    { seed: 5,  name: 'Kentucky',        espnId: 96,   firstFour: false },
    { seed: 6,  name: 'UCLA',            espnId: 26,   firstFour: false },
    { seed: 7,  name: 'Auburn',          espnId: 2,    firstFour: false },
    { seed: 8,  name: 'Utah',            espnId: 254,  firstFour: false },
    { seed: 9,  name: 'Saint Louis',     espnId: 139,  firstFour: false },
    { seed: 10, name: 'Creighton',       espnId: 156,  firstFour: false },
    { seed: 11, name: 'Ball State',      espnId: 2050, firstFour: false },
    { seed: 12, name: 'St. Bonaventure', espnId: 179,  firstFour: false },
    { seed: 13, name: 'Samford',         espnId: 2534, firstFour: false },
    { seed: 14, name: 'Central Conn St', espnId: 2115, firstFour: false },
    { seed: 15, name: 'Valparaiso',      espnId: 2674, firstFour: false },
    { seed: 16, name: 'South Car. St',   espnId: 2569, firstFour: false },
  ],
};

/**
 * Build Round of 64 games from a region's team list.
 * Handles First Four: if two teams share a seed and both have firstFour=true,
 * they are marked as FF opponents. The slot in R64 shows "FF Winner" until picked.
 *
 * Teams are matched by seed number using R64_SEED_MATCHUPS.
 */
export function buildInitialRounds(regionTeams) {
  // Group teams by seed
  const bySeed = {};
  regionTeams.forEach(t => {
    const s = parseInt(t.seed);
    if (!bySeed[s]) bySeed[s] = [];
    bySeed[s].push(t);
  });

  // For each seed that has 2 FF teams, create a FF placeholder team
  // The FF placeholder will be resolved when the user picks the FF winner
  const resolvedSeeds = {};
  Object.keys(bySeed).forEach(seed => {
    const group = bySeed[seed];
    const ffTeams = group.filter(t => t.firstFour);
    if (ffTeams.length >= 2) {
      // Two FF teams share this seed — create a placeholder
      resolvedSeeds[seed] = {
        seed: parseInt(seed),
        name: `${ffTeams[0].name} / ${ffTeams[1].name}`,
        espnId: null,
        firstFour: true,
        ffTeams: [ffTeams[0], ffTeams[1]],
        isFFPlaceholder: true,
      };
    } else {
      // Normal team (or single FF team — treat as normal)
      resolvedSeeds[seed] = group[0];
    }
  });

  return R64_SEED_MATCHUPS.map(([seedA, seedB]) => {
    const teamA = resolvedSeeds[seedA] || { seed: seedA, name: `Seed ${seedA}`, espnId: null };
    const teamB = resolvedSeeds[seedB] || { seed: seedB, name: `Seed ${seedB}`, espnId: null };
    return { top: teamA, bottom: teamB, winner: null };
  });
}

export function buildInitialBracket() {
  return buildInitialBracketFromTeams(TEAMS);
}

export function buildInitialBracketFromTeams(teamsObj) {
  const bracket = {};
  ['East', 'West', 'South', 'Midwest'].forEach(region => {
    const regionTeams = (teamsObj[region] || []).map(t => ({
      ...t,
      seed:   parseInt(t.seed) || 0,
      name:   t.name   || `Seed ${t.seed}`,
      espnId: t.espnId ? parseInt(t.espnId) || null : null,
      firstFour: !!t.firstFour,
    }));
    bracket[region] = {
      rounds: [
        buildInitialRounds(regionTeams),
        Array(4).fill(null).map(() => ({ top: null, bottom: null, winner: null })),
        Array(2).fill(null).map(() => ({ top: null, bottom: null, winner: null })),
        [{ top: null, bottom: null, winner: null }],
      ],
    };
  });
  bracket.finalFour = [
    { top: null, bottom: null, winner: null },
    { top: null, bottom: null, winner: null },
  ];
  bracket.championship = { top: null, bottom: null, winner: null, scoreTop: '', scoreBottom: '' };
  return bracket;
}

// ESPN Tournament Challenge scoring: 10, 20, 40, 80, 160, 320 per round
export const ROUND_POINTS = [10, 20, 40, 80, 160, 320];

export function calcScore(userBracket, officialBracket) {
  if (!officialBracket) return 0;
  let score = 0;
  ['East', 'West', 'South', 'Midwest'].forEach(region => {
    userBracket[region]?.rounds.forEach((round, rIdx) => {
      round.forEach(game => {
        if (!game?.winner) return;
        const offRound = officialBracket[region]?.rounds[rIdx];
        if (offRound?.some(g => g?.winner?.name === game.winner.name))
          score += ROUND_POINTS[rIdx];
      });
    });
  });
  userBracket.finalFour?.forEach((game, idx) => {
    if (game?.winner && officialBracket.finalFour?.[idx]?.winner?.name === game.winner.name)
      score += ROUND_POINTS[4];
  });
  if (userBracket.championship?.winner &&
    officialBracket.championship?.winner?.name === userBracket.championship.winner.name)
    score += ROUND_POINTS[5];
  return score;
}

export function emptyResearchCard(teamName, seed, region) {
  return {
    record: '—', rank: '—', coach: '—', conference: '—',
    kenpom: '—', offense: '—', defense: '—', pace: '—',
    seed, region,
    keyPlayers: [
      { name: '—', pos: '—', stats: '—', note: '—' },
      { name: '—', pos: '—', stats: '—', note: '—' },
    ],
    injuries: 'None reported',
    odds: '—',
    strengths: '—',
    weaknesses: '—',
    analystNote: '—',
  };
}
