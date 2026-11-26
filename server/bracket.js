// Builds bracket structures from normalized games.
//
// Every Players Era bracket is the same 8-team template where all teams play
// three games:
//
//   QF1 ┐                 ┌ SF1 ┐            Final   (W SF1 v W SF2)
//   QF2 ┘ winners ───────>└─────┤            3rd     (L SF1 v L SF2)
//   QF3 ┐                 ┌ SF2 ┘
//   QF4 ┘                 └
//   QF losers ──> CSF1 (L QF1 v L QF2), CSF2 (L QF3 v L QF4)
//                 5th (W CSF1 v W CSF2), 7th (L CSF1 v L CSF2)
//
// ESPN does not say which game feeds which, so the structure is inferred:
//  - round games (no placement label) sorted by tip time: first 4 are QFs,
//    the rest are second-round games;
//  - QF pairing comes from which QFs' teams meet in round two (falls back to
//    tip-time order);
//  - a round-two game is a winners' semi if its teams won their QFs;
//  - placement games come straight from the label (Bracket Final / 3rd / ...).
// Slots whose game still has TBD teams are filled with "projected" teams from
// completed feeder games.

const byDate = (a, b) => new Date(a.date) - new Date(b.date) || a.id.localeCompare(b.id);

function stripGame(g) {
  if (!g) return null;
  const { competitors, ...rest } = g;
  return rest;
}

// Winner ('W') or loser ('L') side of a finished slot, else null.
function result(slot, take) {
  if (!slot || !slot.game || slot.game.status.state !== 'post') return null;
  const w = slot.sides.find((s) => s.winner && s.team && !s.projected);
  if (!w) return null;
  const pick = take === 'W' ? w : slot.sides.find((s) => s !== w);
  return pick && pick.team ? pick : null;
}

function feederLabel(slot, take, fallback) {
  const word = take === 'W' ? 'Winner' : 'Loser';
  const abbrs = slot.sides.map((s) => (s.team ? s.team.abbr : null));
  if (abbrs.every(Boolean)) return `${word} ${abbrs.join('/')}`;
  return fallback || `${word} ${slot.short}`;
}

function makeSlot(id, title, short, game, feeders = []) {
  const expected = feeders.map((f) => ({
    side: result(f.slot, f.take),
    label: feederLabel(f.slot, f.take, f.label),
  }));
  const pool = game ? game.competitors.filter((c) => c.team) : [];
  const sides = [null, null];

  // Real competitors that match the expected feeder go on that feeder's side,
  // so bracket lines connect correctly regardless of ESPN home/away order.
  expected.forEach((e, i) => {
    if (!e.side) return;
    const idx = pool.findIndex((c) => c.team.id === e.side.team.id);
    if (idx >= 0) sides[i] = { ...pool.splice(idx, 1)[0], projected: false, label: e.label };
  });

  for (let i = 0; i < 2; i++) {
    if (sides[i]) continue;
    const e = expected[i];
    if (pool.length) {
      sides[i] = { ...pool.shift(), projected: false, label: e ? e.label : null };
    } else if (e && e.side) {
      sides[i] = {
        team: e.side.team,
        rank: e.side.rank,
        record: null,
        score: null,
        winner: false,
        linescores: [],
        projected: true,
        label: e.label,
      };
    } else {
      sides[i] = { team: null, score: null, winner: false, projected: false, label: e ? e.label : 'TBD' };
    }
  }

  return {
    id,
    title,
    short,
    game: stripGame(game),
    sides,
    feeders: feeders.map((f) => ({ from: f.slot.id, take: f.take })),
  };
}

function teamIds(game) {
  return game.competitors.filter((c) => c.team).map((c) => c.team.id);
}

// Returns QF index pairs, e.g. [[0, 1], [2, 3]], whose teams meet in round two.
function findPairs(qfGames, r2Games) {
  const qfOf = new Map();
  qfGames.forEach((g, i) => teamIds(g).forEach((id) => qfOf.set(id, i)));
  for (const g of r2Games) {
    const idx = [...new Set(teamIds(g).map((id) => qfOf.get(id)).filter((i) => i !== undefined))];
    if (idx.length !== 2) continue;
    idx.sort((a, b) => a - b);
    const other = [0, 1, 2, 3].filter((i) => !idx.includes(i));
    const pairs = [idx, other].sort((a, b) => a[0] - b[0]);
    return pairs;
  }
  return [[0, 1], [2, 3]];
}

function buildBracket({ key, name, venue, finalTitle }, games) {
  const p = `${key}-`;
  const ofKind = (k) => games.filter((g) => g.kind === k).sort(byDate);
  const rounds = ofKind('round');
  const qfGames = rounds.slice(0, 4);
  const r2Games = rounds.slice(4);

  const order = findPairs(qfGames, r2Games).flat();
  const qf = order.map((gi, i) => makeSlot(`${p}qf${i + 1}`, 'Quarterfinal', `QF${i + 1}`, qfGames[gi] || null));

  const semis = [null, null];
  const cons = [null, null];
  for (const g of r2Games) {
    const ids = teamIds(g);
    const qi = qf.findIndex((s) => s.sides.some((sd) => sd.team && ids.includes(sd.team.id)));
    if (qi < 0) continue;
    const tid = ids.find((id) => qf[qi].sides.some((sd) => sd.team && sd.team.id === id));
    const w = result(qf[qi], 'W');
    if (!w) continue;
    const target = w.team.id === tid ? semis : cons;
    const pair = Math.floor(qi / 2);
    if (!target[pair]) target[pair] = g;
  }

  const sf = [0, 1].map((i) =>
    makeSlot(`${p}sf${i + 1}`, 'Semifinal', `SF${i + 1}`, semis[i], [
      { slot: qf[i * 2], take: 'W' },
      { slot: qf[i * 2 + 1], take: 'W' },
    ]),
  );
  const csf = [0, 1].map((i) =>
    makeSlot(`${p}csf${i + 1}`, 'Consolation', `CSF${i + 1}`, cons[i], [
      { slot: qf[i * 2], take: 'L' },
      { slot: qf[i * 2 + 1], take: 'L' },
    ]),
  );
  const final = makeSlot(`${p}final`, finalTitle, 'Final', ofKind('final')[0] || null, [
    { slot: sf[0], take: 'W' },
    { slot: sf[1], take: 'W' },
  ]);
  const third = makeSlot(`${p}third`, '3rd Place', '3rd', ofKind('third')[0] || null, [
    { slot: sf[0], take: 'L' },
    { slot: sf[1], take: 'L' },
  ]);
  const fifth = makeSlot(`${p}fifth`, '5th Place', '5th', ofKind('fifth')[0] || null, [
    { slot: csf[0], take: 'W' },
    { slot: csf[1], take: 'W' },
  ]);
  const seventh = makeSlot(`${p}seventh`, '7th Place', '7th', ofKind('seventh')[0] || null, [
    { slot: csf[0], take: 'L' },
    { slot: csf[1], take: 'L' },
  ]);

  const placements = [final, third, fifth, seventh].flatMap((s, i) => [
    { place: i * 2 + 1, team: (result(s, 'W') || {}).team || null },
    { place: i * 2 + 2, team: (result(s, 'L') || {}).team || null },
  ]);

  return { key, name, venue, slots: { qf, sf, csf, final, third, fifth, seventh }, placements };
}

// Splits an event's games into `n` brackets: by venue first, then any game
// whose known teams all belong to another bracket's quarterfinal field is
// moved there (guards against a game being relocated to the other arena).
function splitBrackets(games, n) {
  if (n === 1) return [games];
  const byVenue = new Map();
  for (const g of games) {
    const k = g.venue ? g.venue.id : 'unknown';
    if (!byVenue.has(k)) byVenue.set(k, []);
    byVenue.get(k).push(g);
  }
  const groups = [...byVenue.values()].sort((a, b) => b.length - a.length);
  const primary = groups.slice(0, n);
  const extra = groups.slice(n).flat();
  const fields = primary.map(
    (gs) =>
      new Set(
        gs
          .filter((g) => g.kind === 'round')
          .sort(byDate)
          .slice(0, 4)
          .flatMap(teamIds),
      ),
  );
  const out = primary.map(() => []);
  const place = (g, fallback) => {
    const ids = teamIds(g);
    const home = ids.length ? fields.findIndex((f) => ids.every((id) => f.has(id))) : -1;
    out[home >= 0 ? home : fallback].push(g);
  };
  primary.forEach((gs, i) => gs.forEach((g) => place(g, i)));
  extra.forEach((g) => place(g, 0));
  return out
    .filter((gs) => gs.length)
    .sort((a, b) => byDate([...a].sort(byDate)[0], [...b].sort(byDate)[0]) || venueOf(a).localeCompare(venueOf(b)));
}

function venueOf(games) {
  const counts = new Map();
  for (const g of games) if (g.venue) counts.set(g.venue.name, (counts.get(g.venue.name) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)[0] || '';
}

function buildEvent(cfg, allGames) {
  const games = allGames
    .filter((g) => g.event === cfg.name)
    .map((g) => (cfg.brackets === 1 && g.kind === 'championship' ? { ...g, kind: 'final' } : g));

  const champGame = games.filter((g) => g.kind === 'championship').sort(byDate)[0] || null;
  const groups = splitBrackets(
    games.filter((g) => g.kind !== 'championship'),
    cfg.brackets,
  );

  const brackets = groups.map((gs, i) => {
    const venue = venueOf(gs);
    return buildBracket(
      {
        key: String.fromCharCode(97 + i),
        name: cfg.brackets === 1 ? cfg.name : `${venue.replace(/\s+Arena$/i, '')} Bracket`,
        venue,
        finalTitle: cfg.brackets === 1 ? 'Championship' : 'Bracket Final',
      },
      gs,
    );
  });

  let championship = null;
  if (cfg.brackets > 1 && brackets.length >= 2) {
    championship = makeSlot(`${cfg.key}-championship`, 'Championship', 'Title', champGame, [
      { slot: brackets[0].slots.final, take: 'W', label: `${brackets[0].name} winner` },
      { slot: brackets[1].slots.final, take: 'W', label: `${brackets[1].name} winner` },
    ]);
  }
  const titleSlot = championship || (brackets[0] && brackets[0].slots.final);
  const champion = (result(titleSlot, 'W') || {}).team || null;
  const runnerUp = (result(titleSlot, 'L') || {}).team || null;

  const records = {};
  const teams = new Map();
  for (const g of games) {
    for (const c of g.competitors) {
      if (!c.team) continue;
      teams.set(c.team.id, c.team);
      records[c.team.id] = records[c.team.id] || { w: 0, l: 0 };
      if (g.status.state === 'post') records[c.team.id][c.winner ? 'w' : 'l'] += 1;
    }
  }

  const sorted = [...games].sort(byDate);
  return {
    key: cfg.key,
    name: cfg.name,
    start: sorted[0] ? sorted[0].date : null,
    end: sorted.length ? sorted[sorted.length - 1].date : null,
    counts: {
      total: games.length,
      live: games.filter((g) => g.status.state === 'in').length,
      final: games.filter((g) => g.status.state === 'post').length,
    },
    brackets,
    championship,
    champion,
    runnerUp,
    records,
    teams: [...teams.values()].sort((a, b) => a.short.localeCompare(b.short)),
  };
}

module.exports = { buildEvent, buildBracket, splitBrackets, findPairs, result, byDate };
