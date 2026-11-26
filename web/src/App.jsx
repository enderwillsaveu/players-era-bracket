import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { CalendarDays, GitFork, Users } from 'lucide-react';
import { useLocalStorage, usePolling } from './lib/usePolling';
import { findTeam, gameSlots, hasTeam } from './lib/bracket';
import { palette } from './lib/colors';
import { TopBar } from './components/TopBar';
import { Ticker } from './components/Ticker';
import { Hero } from './components/Hero';
import { EventBracket } from './components/Bracket';
import { Schedule } from './components/Schedule';
import { Teams } from './components/Teams';
import { GameDrawer } from './components/GameDrawer';
import { Toasts } from './components/Toasts';
import { Seg } from './components/Seg';

const VIEWS = [
  { key: 'bracket', label: 'Bracket', icon: GitFork },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'teams', label: 'Teams', icon: Users },
];

const DEFAULT_THEME = { primary: '#2b1a66', accent: '#ffcc33', accent2: '#ff3d7f' };

function celebrate(team) {
  const p = palette(team) || DEFAULT_THEME;
  const colors = [p.accent, p.accent2, '#ffffff'];
  const base = { particleCount: 90, spread: 70, startVelocity: 55, colors, disableForReducedMotion: true };
  confetti({ ...base, angle: 60, origin: { x: 0, y: 0.7 } });
  confetti({ ...base, angle: 120, origin: { x: 1, y: 0.7 } });
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (toast) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { ...toast, id }]);
      setTimeout(() => dismiss(id), 9000);
    },
    [dismiss],
  );
  return { toasts, push, dismiss };
}

// Compares each poll with the previous one and announces what changed.
function useChangeFeed(data, favoriteId, push) {
  const prev = useRef(null);
  useEffect(() => {
    if (!data) return;
    const snap = new Map();
    const champs = new Map();
    for (const event of data.events) {
      champs.set(event.key, event.champion ? event.champion.id : null);
      for (const slot of gameSlots(event)) {
        snap.set(slot.game.id, {
          state: slot.game.status.state,
          score: slot.sides.map((s) => s.score).join('-'),
          slot,
          event,
        });
      }
    }
    const before = prev.current;
    prev.current = { snap, champs };
    if (!before) return;

    for (const [id, cur] of snap) {
      const was = before.snap.get(id);
      if (!was) continue;
      if (was.state === 'pre' && cur.state === 'in') push({ kind: 'tip', slot: cur.slot, event: cur.event });
      else if (was.state !== 'post' && cur.state === 'post') push({ kind: 'final', slot: cur.slot, event: cur.event });
      else if (cur.state === 'in' && was.score !== cur.score && favoriteId && hasTeam(cur.slot, favoriteId))
        push({ kind: 'score', slot: cur.slot, event: cur.event });
    }
    for (const event of data.events) {
      if (event.champion && !before.champs.get(event.key)) {
        push({ kind: 'crown', team: event.champion, event });
        celebrate(event.champion);
      }
    }
  }, [data, favoriteId, push]);
}

// Also saved so main.jsx can repaint the last theme before the first fetch
// lands, instead of flashing the default colors on every reload.
function applyTheme(team) {
  const p = palette(team) || DEFAULT_THEME;
  const root = document.documentElement.style;
  root.setProperty('--brand', p.primary);
  root.setProperty('--accent', p.accent);
  root.setProperty('--accent-2', p.accent2);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', team ? p.primary : '#07080d');
  try {
    if (team) localStorage.setItem('pe.theme', JSON.stringify(p));
    else localStorage.removeItem('pe.theme');
  } catch {
    /* storage unavailable */
  }
}

function Skeleton() {
  return (
    <div className="skeleton">
      <div className="sk sk--title" />
      <div className="sk sk--chips" />
      <div className="sk-grid">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="sk sk--col" />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  // 'auto' follows the server's suggested rate, a number pins it (ms), 'off' pauses.
  const [rate, setRate] = useLocalStorage('pe.rate', 'auto');
  const poll = usePolling('/api/tournament', {
    paused: rate === 'off',
    intervalMs: typeof rate === 'number' ? rate : null,
  });
  const data = poll.data;

  const [eventKey, setEventKey] = useLocalStorage('pe.event', null);
  const [view, setView] = useLocalStorage('pe.view', 'bracket');
  const [favorite, setFavorite] = useLocalStorage('pe.team', null);
  const [hoverTeam, setHoverTeam] = useState(null);
  const [selected, setSelected] = useState(null); // { slotId, eventKey }
  const { toasts, push, dismiss } = useToasts();

  const event = useMemo(() => {
    if (!data) return null;
    return data.events.find((e) => e.key === eventKey) || data.events.find((e) => e.counts.live > 0) || data.events[0];
  }, [data, eventKey]);

  const allTeams = useMemo(() => {
    if (!data) return [];
    const m = new Map();
    data.events.forEach((e) => e.teams.forEach((t) => m.set(t.id, t)));
    return [...m.values()].sort((a, b) => a.short.localeCompare(b.short));
  }, [data]);

  // Deep links: ?team=TENN&event=pe8&view=teams&game=401920518 (applied once).
  const deepLinked = useRef(false);
  useEffect(() => {
    if (!data || deepLinked.current) return;
    deepLinked.current = true;
    const q = new URLSearchParams(window.location.search);
    const team = q.get('team');
    if (team) {
      const t = data.events
        .flatMap((e) => e.teams)
        .find((x) => x.id === team || x.abbr.toLowerCase() === team.toLowerCase());
      if (t) setFavorite(t.id);
    }
    const ev = data.events.find((e) => e.key === q.get('event'));
    if (ev) setEventKey(ev.key);
    if (VIEWS.some((v) => v.key === q.get('view'))) setView(q.get('view'));
    const gameId = q.get('game');
    if (gameId) {
      for (const e of data.events) {
        const slot = gameSlots(e).find((x) => x.game.id === gameId);
        if (slot) setSelected({ slotId: slot.id, eventKey: e.key });
      }
    }
  }, [data, setFavorite, setEventKey, setView]);

  const favoriteTeam = findTeam(data, favorite);
  // Wait for data before theming: before the first fetch, favoriteTeam is
  // unknown, and resetting to defaults would undo the boot theme.
  useEffect(() => {
    if (data) applyTheme(favoriteTeam);
  }, [data, favoriteTeam]);
  useChangeFeed(data, favorite, push);

  // Re-resolve the open game from the latest poll so the drawer stays live.
  const openSlot = useMemo(() => {
    if (!selected || !data) return null;
    const ev = data.events.find((e) => e.key === selected.eventKey);
    const slot = ev && gameSlots(ev).find((s) => s.id === selected.slotId);
    return slot ? { slot, event: ev } : null;
  }, [selected, data]);

  const onOpen = useCallback(
    (slot, ev) => slot.game && setSelected({ slotId: slot.id, eventKey: (ev || event).key }),
    [event],
  );
  const closeDrawer = useCallback(() => setSelected(null), []);

  const focus = { hoverTeam, favoriteId: favorite, onHoverTeam: setHoverTeam };

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true">
        <div className="backdrop__glow" />
        {favoriteTeam && (
          <img
            key={favoriteTeam.id}
            className="backdrop__logo"
            src={favoriteTeam.logoDark || favoriteTeam.logo}
            alt=""
          />
        )}
        <div className="backdrop__grid" />
      </div>

      <TopBar
        teams={allTeams}
        favorite={favorite}
        setFavorite={setFavorite}
        poll={poll}
        mode={data ? data.mode : null}
        rate={rate}
        setRate={setRate}
      />
      {data && <Ticker data={data} onOpen={onOpen} />}

      <main className="main">
        {!data && poll.error && (
          <div className="fatal">
            <h2>Can’t reach the scoreboard</h2>
            <p>{poll.error}</p>
            <button className="btn" onClick={poll.refresh}>
              Try again
            </button>
          </div>
        )}
        {!data && !poll.error && <Skeleton />}

        {data && event && (
          <>
            {data.stale && <p className="notice">ESPN isn’t responding — showing the last scores we got.</p>}
            <Hero data={data} event={event} favoriteTeam={favoriteTeam} onOpen={onOpen} onCelebrate={celebrate} />

            <nav className="tabsbar">
              <Seg
                label="Tournament"
                value={event.key}
                onChange={setEventKey}
                items={data.events.map((e) => ({
                  key: e.key,
                  label: (
                    <>
                      {e.name}
                      {e.counts.live > 0 && <span className="pulse-dot" />}
                    </>
                  ),
                }))}
              />
              <Seg
                label="View"
                className="seg--views"
                value={view}
                onChange={setView}
                items={VIEWS.map(({ key, label, icon: Icon }) => ({
                  key,
                  label: (
                    <>
                      <Icon size={15} /> {label}
                    </>
                  ),
                }))}
              />
            </nav>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${event.key}-${view}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                {view === 'bracket' && <EventBracket event={event} focus={focus} onOpen={onOpen} />}
                {view === 'schedule' && <Schedule event={event} focus={focus} onOpen={onOpen} />}
                {view === 'teams' && <Teams event={event} focus={focus} setFavorite={setFavorite} onOpen={onOpen} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>

      <footer className="foot">
        Unofficial fan site. Scores, logos and colors from ESPN’s public scoreboard API — not affiliated with Players
        Era, ESPN, MGM Resorts or any school. Times shown in your time zone.
        <span className="foot__credit">
          Built with{' '}
          <a href="https://claude.com/claude-code" target="_blank" rel="noreferrer">
            Claude Code
          </a>
        </span>
      </footer>

      <AnimatePresence>
        {openSlot && (
          <GameDrawer key={openSlot.slot.id} slot={openSlot.slot} event={openSlot.event} onClose={closeDrawer} />
        )}
      </AnimatePresence>
      <Toasts toasts={toasts} dismiss={dismiss} onOpen={onOpen} />
    </div>
  );
}
