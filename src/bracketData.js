// src/bracketData.js
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║              📅 ANNUAL UPDATE — THIS IS THE ONLY FILE YOU CHANGE        ║
// ║                                                                          ║
// ║  Every March after Selection Sunday:                                     ║
// ║  1. Update CURRENT_YEAR                                                  ║
// ║  2. Replace all 64 teams in the TEAMS object below                       ║
// ║  3. Mark First Four slots with  firstFour: true                          ║
// ║  4. Save the file — StackBlitz auto-deploys, done!                       ║
// ║                                                                          ║
// ║  Finding ESPN IDs:                                                        ║
// ║  Go to espn.com/mens-college-basketball/team/_/id/150/duke               ║
// ║  The number after /id/ is the espnId (150 = Duke)                        ║
// ║                                                                          ║
// ║  First Four: NCAA rotates which seeds/regions have play-in games.        ║
// ║  Set firstFour: true on whichever slots are play-ins that year.          ║
// ║  The bracket handles them automatically — no other changes needed.       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── STEP 1: UPDATE YEAR ──────────────────────────────────────────────────────
export const CURRENT_YEAR = 2025;

// ── STEP 2: UPDATE ALL 64 TEAMS ─────────────────────────────────────────────
// Each region must have exactly 16 entries (seeds 1–16).
// Order them seed 1 at index 0 through seed 16 at index 15.
export const TEAMS = {

  // ── EAST REGION ────────────────────────────────────────────────────────────
  East: [
    { seed: 1,  name: 'Duke',           espnId: 150   },
    { seed: 2,  name: 'Alabama',        espnId: 333   },
    { seed: 3,  name: 'Wisconsin',      espnId: 275   },
    { seed: 4,  name: 'Arizona',        espnId: 12    },
    { seed: 5,  name: 'Oregon',         espnId: 2483  },
    { seed: 6,  name: 'BYU',            espnId: 252   },
    { seed: 7,  name: "Saint Mary's",   espnId: 2608  },
    { seed: 8,  name: 'Mississippi St', espnId: 344   },
    { seed: 9,  name: 'Baylor',         espnId: 239   },
    { seed: 10, name: 'Vanderbilt',     espnId: 238   },
    { seed: 11, name: 'VCU',            espnId: 2670  },
    { seed: 12, name: 'Liberty',        espnId: 2335  },
    { seed: 13, name: 'Akron',          espnId: 2006  },
    { seed: 14, name: 'Montana',        espnId: 149   },
    { seed: 15, name: 'Robert Morris',  espnId: 2523  },
    { seed: 16, name: 'FF: TBD',        espnId: null, firstFour: true },
  ],

  // ── WEST REGION ────────────────────────────────────────────────────────────
  West: [
    { seed: 1,  name: 'Auburn',         espnId: 2     },
    { seed: 2,  name: 'Michigan St',    espnId: 127   },
    { seed: 3,  name: 'Iowa St',        espnId: 66    },
    { seed: 4,  name: 'Texas A&M',      espnId: 245   },
    { seed: 5,  name: 'Michigan',       espnId: 130   },
    { seed: 6,  name: 'Ole Miss',       espnId: 145   },
    { seed: 7,  name: 'Marquette',      espnId: 269   },
    { seed: 8,  name: 'Louisville',     espnId: 97    },
    { seed: 9,  name: 'Creighton',      espnId: 156   },
    { seed: 10, name: 'New Mexico',     espnId: 167   },
    { seed: 11, name: 'Drake',          espnId: 2181  },
    { seed: 12, name: 'UC San Diego',   espnId: 28    },
    { seed: 13, name: 'Yale',           espnId: 43    },
    { seed: 14, name: 'Lipscomb',       espnId: 2346  },
    { seed: 15, name: 'Bryant',         espnId: 2803  },
    { seed: 16, name: 'FF: TBD',        espnId: null, firstFour: true },
  ],

  // ── SOUTH REGION ───────────────────────────────────────────────────────────
  South: [
    { seed: 1,  name: 'Florida',        espnId: 57    },
    { seed: 2,  name: "St. John's",     espnId: 2599  },
    { seed: 3,  name: 'Kentucky',       espnId: 96    },
    { seed: 4,  name: 'Maryland',       espnId: 120   },
    { seed: 5,  name: 'Memphis',        espnId: 235   },
    { seed: 6,  name: 'Missouri',       espnId: 142   },
    { seed: 7,  name: 'Kansas',         espnId: 2305  },
    { seed: 8,  name: 'Connecticut',    espnId: 41    },
    { seed: 9,  name: 'Oklahoma',       espnId: 201   },
    { seed: 10, name: 'Arkansas',       espnId: 8     },
    { seed: 11, name: 'Texas',          espnId: 251   },
    { seed: 12, name: 'McNeese',        espnId: 2383  },
    { seed: 13, name: 'High Point',     espnId: 2272  },
    { seed: 14, name: 'Troy',           espnId: 2653  },
    { seed: 15, name: 'Wofford',        espnId: 2747  },
    { seed: 16, name: 'FF: TBD',        espnId: null, firstFour: true },
  ],

  // ── MIDWEST REGION ─────────────────────────────────────────────────────────
  Midwest: [
    { seed: 1,  name: 'Houston',        espnId: 248   },
    { seed: 2,  name: 'Tennessee',      espnId: 2633  },
    { seed: 3,  name: 'Kansas',         espnId: 2305  },
    { seed: 4,  name: 'Purdue',         espnId: 2509  },
    { seed: 5,  name: 'Clemson',        espnId: 228   },
    { seed: 6,  name: 'Illinois',       espnId: 356   },
    { seed: 7,  name: 'UCLA',           espnId: 26    },
    { seed: 8,  name: 'Colorado',       espnId: 38    },
    { seed: 9,  name: 'Georgia',        espnId: 61    },
    { seed: 10, name: 'Utah State',     espnId: 328   },
    { seed: 11, name: 'Xavier',         espnId: 2753  },
    { seed: 12, name: 'UC Irvine',      espnId: 2086  },
    { seed: 13, name: 'Vermont',        espnId: 261   },
    { seed: 14, name: 'Colgate',        espnId: 166   },
    { seed: 15, name: 'Longwood',       espnId: 2361  },
    { seed: 16, name: 'FF: TBD',        espnId: null, firstFour: true },
  ],
};

// ── DO NOT EDIT BELOW THIS LINE ──────────────────────────────────────────────
// Bracket logic, scoring, and research data.
// These never change year to year.

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
  const bracket = {};
  ['East', 'West', 'South', 'Midwest'].forEach(region => {
    bracket[region] = {
      rounds: [
        buildInitialRounds(TEAMS[region]),
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

export const ROUND_POINTS = [1, 2, 4, 8, 16, 32];

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

// Team research cards — update or expand each year as desired
export const TEAM_RESEARCH = {
  'Duke': {
    record: '31-4', rank: '#2 AP', coach: 'Jon Scheyer', conference: 'ACC',
    kenpom: '#3', offense: '118.2', defense: '93.1', pace: '72.4',
    keyPlayers: [
      { name: 'Cooper Flagg',    pos: 'F', stats: '18.9 PPG / 8.4 RPG / 4.2 APG', note: 'Projected #1 overall NBA pick' },
      { name: 'Khaman Maluach', pos: 'C', stats: '14.1 PPG / 7.8 RPG',            note: 'Elite rim protector' },
    ],
    injuries:    'None reported',
    odds:        '+450',
    strengths:   'Elite frontcourt depth, top-5 defense nationally, tournament pedigree',
    weaknesses:  '3-pt consistency, can struggle vs physical teams',
    analystNote: "Flagg is the best player in the field. Duke's ceiling is a championship.",
  },
  'Auburn': {
    record: '29-5', rank: '#1 AP', coach: 'Bruce Pearl', conference: 'SEC',
    kenpom: '#1', offense: '121.4', defense: '91.8', pace: '74.1',
    keyPlayers: [
      { name: 'Johni Broome',         pos: 'C', stats: '18.6 PPG / 10.8 RPG / 3.1 BPG', note: 'Preseason POY candidate' },
      { name: 'Chad Baker-Mazara',    pos: 'G', stats: '13.2 PPG / 4.1 APG',             note: 'Elite perimeter shooter' },
    ],
    injuries:    'Day-to-day: Dylan Cardwell (ankle)',
    odds:        '+380',
    strengths:   'Best team in SEC, elite two-way from Broome, deep backcourt',
    weaknesses:  "Pearl's tourney history is mixed",
    analystNote: 'The #1 overall seed for good reason. Broome is a nightmare matchup.',
  },
  'Florida': {
    record: '30-4', rank: '#3 AP', coach: 'Todd Golden', conference: 'SEC',
    kenpom: '#5', offense: '116.8', defense: '94.2', pace: '71.9',
    keyPlayers: [
      { name: 'Walter Clayton Jr.', pos: 'G', stats: '19.8 PPG / 4.5 APG', note: 'SEC Player of the Year' },
      { name: 'Alex Condon',        pos: 'C', stats: '12.1 PPG / 7.9 RPG', note: 'Versatile big' },
    ],
    injuries:    'None reported',
    odds:        '+600',
    strengths:   'Clayton is a star, balanced scoring, strong SEC schedule',
    weaknesses:  'Can go cold from 3, depth tested in SEC tournament',
    analystNote: "Florida has all the pieces. Clayton is the X-factor — when he's hot, they can beat anyone.",
  },
  'Houston': {
    record: '28-6', rank: '#4 AP', coach: 'Kelvin Sampson', conference: 'Big 12',
    kenpom: '#4', offense: '113.2', defense: '90.2', pace: '68.1',
    keyPlayers: [
      { name: "LJ Cryer",     pos: 'G', stats: '16.4 PPG / 3.8 APG', note: 'Veteran leader' },
      { name: "J'Wan Roberts", pos: 'F', stats: '12.9 PPG / 9.1 RPG', note: 'Defensive anchor' },
    ],
    injuries:    'None reported',
    odds:        '+700',
    strengths:   'Elite defense, slow methodical pace, tournament battle-tested',
    weaknesses:  'Offense can stall against zones',
    analystNote: "Sampson's teams always show up in March. The defense is elite.",
  },
};
