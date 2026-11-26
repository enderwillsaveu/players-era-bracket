// Turns raw ESPN payloads into the compact shapes the bracket builder and the
// web client use.

function parseNote(headline) {
  if (!headline) return { event: null, label: null };
  const [event, ...rest] = headline.split(' - ');
  return { event: event.trim(), label: rest.join(' - ').trim() || null };
}

function kindFromLabel(label) {
  if (!label) return 'round';
  const l = label.toLowerCase();
  if (l.includes('third')) return 'third';
  if (l.includes('fifth')) return 'fifth';
  if (l.includes('seventh')) return 'seventh';
  if (l.includes('bracket final')) return 'final';
  if (l.includes('championship')) return 'championship';
  return 'round';
}

function hex(c) {
  return c && /^[0-9a-f]{6}$/i.test(c) ? `#${c.toLowerCase()}` : null;
}

function logoFrom(logos, rel) {
  const hit = (logos || []).find((l) => (l.rel || []).includes(rel));
  return hit ? hit.href : null;
}

function normalizeTeam(t) {
  if (!t || !t.id || t.id === '-1' || t.abbreviation === 'TBD') return null;
  return {
    id: String(t.id),
    abbr: t.abbreviation,
    name: t.displayName,
    short: t.shortDisplayName || t.location,
    location: t.location,
    mascot: t.name,
    color: hex(t.color) || '#555555',
    alt: hex(t.alternateColor) || '#dddddd',
    logo: t.logo || logoFrom(t.logos, 'default'),
    logoDark: t.logoDark || logoFrom(t.logos, 'dark'),
  };
}

function normalizeCompetitor(c, state) {
  const team = normalizeTeam(c.team);
  const rank = c.curatedRank && c.curatedRank.current;
  const total = (c.records || []).find((r) => r.type === 'total');
  return {
    team,
    homeAway: c.homeAway || null,
    score: team && state !== 'pre' && c.score != null ? Number(c.score) : null,
    winner: Boolean(c.winner),
    rank: rank && rank <= 25 ? rank : null,
    record: total ? total.summary : null,
    linescores: (c.linescores || []).map((l) => Number(l.displayValue ?? l.value)),
  };
}

function normalizeStatus(s) {
  const type = (s && s.type) || {};
  return {
    state: type.state || 'pre', // pre | in | post
    name: type.name || null,
    completed: Boolean(type.completed),
    detail: type.detail || '',
    shortDetail: type.shortDetail || '',
    clock: s && s.displayClock,
    period: s && s.period,
  };
}

// Returns a normalized game, or null if the ESPN event has no usable note.
function normalizeGame(e) {
  const comp = e.competitions && e.competitions[0];
  if (!comp) return null;
  const headline = (comp.notes || []).map((n) => n.headline).find(Boolean);
  const { event, label } = parseNote(headline);
  if (!event) return null;
  const status = normalizeStatus(comp.status || e.status);
  const odds = comp.odds && comp.odds[0];
  const broadcast = (comp.broadcasts || []).flatMap((b) => b.names || []);
  return {
    id: String(e.id),
    date: e.date,
    event,
    label,
    kind: kindFromLabel(label),
    venue: comp.venue ? { id: String(comp.venue.id), name: comp.venue.fullName } : null,
    status,
    broadcast: broadcast.length ? broadcast.join(' · ') : null,
    odds: odds ? { details: odds.details || null, overUnder: odds.overUnder ?? null } : null,
    competitors: (comp.competitors || []).map((c) => normalizeCompetitor(c, status.state)),
  };
}

const STAT_KEYS = {
  'fieldGoalsMade-fieldGoalsAttempted': 'fg',
  fieldGoalPct: 'fgPct',
  'threePointFieldGoalsMade-threePointFieldGoalsAttempted': 'three',
  threePointFieldGoalPct: 'threePct',
  'freeThrowsMade-freeThrowsAttempted': 'ft',
  freeThrowPct: 'ftPct',
  totalRebounds: 'reb',
  offensiveRebounds: 'oreb',
  assists: 'ast',
  steals: 'stl',
  blocks: 'blk',
  totalTurnovers: 'to',
  pointsInPaint: 'paint',
  fastBreakPoints: 'fastBreak',
  turnoverPoints: 'ptsOffTo',
  largestLead: 'largestLead',
};

function normalizeSummary(d) {
  const header = (d.header && d.header.competitions && d.header.competitions[0]) || {};
  const status = normalizeStatus(header.status);
  const info = d.gameInfo || {};

  const statsByTeam = new Map();
  for (const t of (d.boxscore && d.boxscore.teams) || []) {
    const stats = {};
    for (const s of t.statistics || []) {
      const key = STAT_KEYS[s.name];
      if (key) stats[key] = s.displayValue;
    }
    statsByTeam.set(String(t.team.id), stats);
  }

  const leadersByTeam = new Map();
  for (const l of d.leaders || []) {
    const list = [];
    for (const cat of ['points', 'rebounds', 'assists']) {
      const group = (l.leaders || []).find((x) => x.name === cat);
      const top = group && group.leaders && group.leaders[0];
      if (!top) continue;
      list.push({
        category: cat,
        value: top.displayValue,
        name: top.athlete.displayName,
        short: top.athlete.shortName,
        jersey: top.athlete.jersey || null,
        position: top.athlete.position ? top.athlete.position.abbreviation : null,
        headshot: top.athlete.headshot ? top.athlete.headshot.href : null,
      });
    }
    leadersByTeam.set(String(l.team.id), list);
  }

  const teams = (header.competitors || []).map((c) => {
    const base = normalizeCompetitor(c, status.state);
    const id = base.team && base.team.id;
    return { ...base, stats: statsByTeam.get(id) || null, leaders: leadersByTeam.get(id) || [] };
  });

  // Win probability, downsampled, with the play index where the 2nd half starts.
  const periodOf = new Map((d.plays || []).map((p) => [String(p.id), p.period && p.period.number]));
  const wp = d.winprobability || [];
  const step = Math.max(1, Math.ceil(wp.length / 240));
  const winProb = [];
  for (let i = 0; i < wp.length; i += step) {
    winProb.push({ home: wp[i].homeWinPercentage, period: periodOf.get(String(wp[i].playId)) || null });
  }
  if (wp.length && (wp.length - 1) % step !== 0) {
    const last = wp[wp.length - 1];
    winProb.push({ home: last.homeWinPercentage, period: periodOf.get(String(last.playId)) || null });
  }

  const odds = (d.pickcenter && d.pickcenter[0]) || null;
  return {
    id: String(header.id || (d.header && d.header.id)),
    date: header.date,
    status,
    venue: info.venue ? info.venue.fullName : null,
    attendance: info.attendance || null,
    broadcast: (header.broadcasts || []).map((b) => b.media && b.media.shortName).filter(Boolean).join(' · ') || null,
    odds: odds ? { details: odds.details || null, overUnder: odds.overUnder ?? null } : null,
    teams,
    winProb,
  };
}

module.exports = { parseNote, kindFromLabel, normalizeGame, normalizeSummary };
