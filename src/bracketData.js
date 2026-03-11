// src/bracketData.js
// You no longer need to edit this file every year!
// Use Admin → Set Up Teams to enter teams each March.
// Research data is now stored in Firestore and auto-generated via AI.

export const CURRENT_YEAR = 2000;

// 2000 NCAA Tournament bracket — placeholder until admin sets up current year
// Champion: Michigan State | Fun fact: only one #1 seed reached the Final Four!
export const TEAMS = {
  // East: #1 Duke — won by #5 Florida (huge upset!)
  East: [
    { seed: 1,  name: 'Duke',            espnId: 150  },
    { seed: 2,  name: 'Temple',          espnId: 218  },
    { seed: 3,  name: 'Oklahoma State',  espnId: 197  },
    { seed: 4,  name: 'Illinois',        espnId: 356  },
    { seed: 5,  name: 'Florida',         espnId: 57   },
    { seed: 6,  name: 'Indiana',         espnId: 84   },
    { seed: 7,  name: 'Oregon',          espnId: 2483 },
    { seed: 8,  name: 'Kansas',          espnId: 2305 },
    { seed: 9,  name: 'DePaul',          espnId: 305  },
    { seed: 10, name: 'Seton Hall',      espnId: 2550 },
    { seed: 11, name: 'Pepperdine',      espnId: 2502 },
    { seed: 12, name: 'Butler',          espnId: 2781 },
    { seed: 13, name: 'Penn',            espnId: 219  },
    { seed: 14, name: 'Hofstra',         espnId: 2269 },
    { seed: 15, name: 'Lafayette',       espnId: 322  },
    { seed: 16, name: 'Lamar',           espnId: 2321 },
  ],
  // West: #1 Arizona — won by #8 Wisconsin
  West: [
    { seed: 1,  name: 'Arizona',         espnId: 12   },
    { seed: 2,  name: "St. John's",      espnId: 2599 },
    { seed: 3,  name: 'Oklahoma',        espnId: 201  },
    { seed: 4,  name: 'LSU',             espnId: 99   },
    { seed: 5,  name: 'Texas',           espnId: 251  },
    { seed: 6,  name: 'Purdue',          espnId: 2509 },
    { seed: 7,  name: 'Louisville',      espnId: 97   },
    { seed: 8,  name: 'Wisconsin',       espnId: 275  },
    { seed: 9,  name: 'Fresno State',    espnId: 278  },
    { seed: 10, name: 'Gonzaga',         espnId: 2250 },
    { seed: 11, name: 'Dayton',          espnId: 2168 },
    { seed: 12, name: 'Indiana State',   espnId: 282  },
    { seed: 13, name: 'SE Missouri St',  espnId: 2546 },
    { seed: 14, name: 'Winthrop',        espnId: 2742 },
    { seed: 15, name: 'N. Arizona',      espnId: 2464 },
    { seed: 16, name: 'Jackson State',   espnId: 2296 },
  ],
  // South: #1 Stanford — won by #8 North Carolina
  South: [
    { seed: 1,  name: 'Stanford',        espnId: 24   },
    { seed: 2,  name: 'Cincinnati',      espnId: 2132 },
    { seed: 3,  name: 'Ohio State',      espnId: 194  },
    { seed: 4,  name: 'Tennessee',       espnId: 2633 },
    { seed: 5,  name: 'Connecticut',     espnId: 41   },
    { seed: 6,  name: 'Miami (FL)',      espnId: 2390 },
    { seed: 7,  name: 'Tulsa',           espnId: 2567 },
    { seed: 8,  name: 'North Carolina',  espnId: 153  },
    { seed: 9,  name: 'Missouri',        espnId: 142  },
    { seed: 10, name: 'Arkansas',        espnId: 8    },
    { seed: 11, name: 'UNLV',            espnId: 2439 },
    { seed: 12, name: 'Louisiana-Laf',   espnId: 309  },
    { seed: 13, name: 'Iona',            espnId: 314  },
    { seed: 14, name: 'Utah State',      espnId: 328  },
    { seed: 15, name: 'UNC Wilmington',  espnId: 2670 },
    { seed: 16, name: 'Appalachian St',  espnId: 2016 },
  ],
  // Midwest: #1 Michigan State — the eventual champion!
  Midwest: [
    { seed: 1,  name: 'Michigan State',  espnId: 127  },
    { seed: 2,  name: 'Iowa State',      espnId: 66   },
    { seed: 3,  name: 'Maryland',        espnId: 120  },
    { seed: 4,  name: 'Syracuse',        espnId: 183  },
    { seed: 5,  name: 'Kentucky',        espnId: 96   },
    { seed: 6,  name: 'UCLA',            espnId: 26   },
    { seed: 7,  name: 'Auburn',          espnId: 2    },
    { seed: 8,  name: 'Utah',            espnId: 254  },
    { seed: 9,  name: 'Saint Louis',     espnId: 139  },
    { seed: 10, name: 'Creighton',       espnId: 156  },
    { seed: 11, name: 'Ball State',      espnId: 2050 },
    { seed: 12, name: 'St. Bonaventure', espnId: 179  },
    { seed: 13, name: 'Samford',         espnId: 2534 },
    { seed: 14, name: 'Central Conn St', espnId: 2115 },
    { seed: 15, name: 'Valparaiso',      espnId: 2674 },
    { seed: 16, name: 'South Car. St',   espnId: 2569 },
  ],
};
// Standard NCAA seeding matchup order for Round of 64
export const R64_MATCHUPS = [
  [0, 15], [7, 8], [4, 11], [3, 12],
  [5, 10], [2, 13], [6, 9],  [1, 14],
];

export function buildInitialRounds(regionTeams) {
  return R64_MATCHUPS.map(([a, b]) => ({
    top: regionTeams[a], bottom: regionTeams[b], winner: null,
  }));
}

export function buildInitialBracket() {
  return buildInitialBracketFromTeams(TEAMS);
}

export function buildInitialBracketFromTeams(teamsObj) {
  const bracket = {};
  ['East', 'West', 'South', 'Midwest'].forEach(region => {
    const regionTeams = (teamsObj[region] || []).map(t => ({
      ...t,
      name:   t.name   || `Seed ${t.seed}`,
      espnId: t.espnId ? parseInt(t.espnId) || null : null,
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
// (same doubling ratio as 1,2,4,8,16,32 but matches ESPN's exact point values)
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

// Empty research card template — used as default when AI data isn't available yet
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
















