const config = require('./config');
const espn = require('./espn');
const { normalizeGame, normalizeSummary } = require('./normalize');
const { buildEvent } = require('./bracket');

const SECOND = 1000;
const MINUTE = 60 * SECOND;

// How often clients should poll, based on what's happening right now.
function pollPlan(games, now = Date.now()) {
  if (games.some((g) => g.status.state === 'in')) return { mode: 'live', pollMs: 15 * SECOND, cacheMs: 8 * SECOND };
  const soon = games.some((g) => {
    if (g.status.state !== 'pre') return false;
    const t = new Date(g.date).getTime();
    return t - now < 20 * MINUTE; // includes games past tip time that ESPN hasn't flipped to live yet
  });
  if (soon) return { mode: 'soon', pollMs: 30 * SECOND, cacheMs: 20 * SECOND };
  if (games.some((g) => g.status.state === 'pre')) return { mode: 'idle', pollMs: 2 * MINUTE, cacheMs: MINUTE };
  return { mode: 'done', pollMs: 10 * MINUTE, cacheMs: 5 * MINUTE };
}

async function loadGames() {
  const dates = [...new Set(config.events.flatMap((e) => e.dates))];
  const boards = await Promise.all(dates.map((d) => espn.fetchScoreboard(d)));
  const names = new Set(config.events.map((e) => e.name));
  const byId = new Map();
  for (const board of boards) {
    for (const ev of board.events || []) {
      const g = normalizeGame(ev);
      if (g && names.has(g.event)) byId.set(g.id, g);
    }
  }
  return [...byId.values()];
}

function buildTournament(games, now = Date.now()) {
  const plan = pollPlan(games, now);
  const upcoming = games
    .filter((g) => g.status.state === 'pre')
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  return {
    title: config.title,
    location: config.location,
    generatedAt: new Date(now).toISOString(),
    mode: plan.mode,
    pollMs: plan.pollMs,
    nextTip: upcoming ? upcoming.date : null,
    events: config.events.map((cfg) => buildEvent(cfg, games)),
    _cacheMs: plan.cacheMs,
  };
}

// Single shared cache so many browser tabs don't multiply ESPN traffic.
function createCache(loader, ttlOf) {
  let value = null;
  let fetchedAt = 0;
  let inflight = null;
  return async function get() {
    if (value && Date.now() - fetchedAt < ttlOf(value)) return { value, stale: false };
    if (!inflight) {
      inflight = loader()
        .then((v) => {
          value = v;
          fetchedAt = Date.now();
          return { value, stale: false };
        })
        .finally(() => {
          inflight = null;
        });
    }
    try {
      return await inflight;
    } catch (err) {
      if (value) return { value, stale: true, error: err.message };
      throw err;
    }
  };
}

const getTournament = createCache(
  async () => buildTournament(await loadGames()),
  (t) => t._cacheMs,
);

const summaryCaches = new Map();
function getGame(id) {
  if (!summaryCaches.has(id)) {
    summaryCaches.set(
      id,
      createCache(
        async () => normalizeSummary(await espn.fetchSummary(id)),
        (s) => (s.status.state === 'in' ? 8 * SECOND : s.status.state === 'pre' ? MINUTE : 10 * MINUTE),
      ),
    );
  }
  return summaryCaches.get(id)();
}

module.exports = { getTournament, getGame, buildTournament, pollPlan, createCache };
