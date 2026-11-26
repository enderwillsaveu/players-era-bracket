import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, RefreshCw, Search, Shield, X } from 'lucide-react';
import { teamVars } from '../lib/colors';
import { useNow } from '../lib/usePolling';
import { TeamLogo } from './TeamLogo';

const MODE_LABEL = {
  live: 'Live',
  soon: 'Tip-off soon',
  idle: 'Upcoming',
  done: 'Final',
};

// 'auto' follows the server: 15s with a game on, 30s near tip-off, 2 min
// with games later, 10 min once everything is final.
const RATES = [
  { value: 'auto', label: 'Auto' },
  { value: 10000, label: 'Every 10s' },
  { value: 30000, label: 'Every 30s' },
  { value: 60000, label: 'Every minute' },
  { value: 300000, label: 'Every 5 min' },
  { value: 'off', label: 'Paused' },
];

const every = (ms) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)} min`);

// Closes a popover on outside press or Escape.
function useDismiss(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && close();
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, close]);
}

// Fills over `ms` with a CSS animation. Keyed on the deadline by the caller,
// so it restarts per fetch without a React re-render every second.
function Ring({ ms }) {
  return (
    <svg className="poll__svg" viewBox="0 0 20 20" width="30" height="30" aria-hidden="true">
      <circle cx="10" cy="10" r="8" className="poll__track" />
      {ms ? (
        <circle
          cx="10"
          cy="10"
          r="8"
          pathLength="100"
          className="poll__prog"
          style={{ animationDuration: `${ms}ms` }}
        />
      ) : null}
    </svg>
  );
}

function Countdown({ at }) {
  const now = useNow(1000);
  return <>{Math.max(0, Math.ceil((at - now) / 1000))}s</>;
}

function PollStatus({ poll, mode, rate, setRate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const paused = rate === 'off';
  const label = poll.error ? 'Reconnecting' : MODE_LABEL[mode] || 'Loading';
  const sub = poll.error
    ? 'Retrying shortly'
    : paused
      ? 'Updates paused'
      : poll.updatedAt
        ? `Updates every ${every(poll.interval)}`
        : 'Connecting…';

  return (
    <div className="poll" ref={ref}>
      <button
        className={`poll__btn poll--${poll.error ? 'error' : paused ? 'paused' : mode}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${label}. ${sub}. Update settings`}
      >
        <span className="poll__dot" />
        <span className="poll__text">
          <strong>{label}</strong>
          <span>{sub}</span>
        </span>
        <span className="poll__ring">
          <Ring key={poll.nextAt || 'idle'} ms={paused || !poll.nextAt ? 0 : poll.delayMs} />
          <RefreshCw size={12} className={poll.loading ? 'spin' : ''} />
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="pollmenu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
          >
            <div className="pollmenu__head">
              <strong>{label}</strong>
              <span>
                {paused ? (
                  'Auto-update is paused'
                ) : poll.nextAt ? (
                  <>
                    Next update in <Countdown at={poll.nextAt} />
                  </>
                ) : (
                  'Updating…'
                )}
              </span>
            </div>
            <button className="pollmenu__now" onClick={poll.refresh} disabled={poll.loading}>
              <RefreshCw size={14} className={poll.loading ? 'spin' : ''} /> Refresh now
            </button>
            <div className="pollmenu__label">Update rate</div>
            <div role="radiogroup" aria-label="Update rate">
              {RATES.map((r) => (
                <button
                  key={r.value}
                  role="radio"
                  aria-checked={rate === r.value}
                  className={`pollmenu__opt ${rate === r.value ? 'is-on' : ''}`}
                  onClick={() => {
                    setRate(r.value);
                    setOpen(false);
                  }}
                >
                  <span>
                    {r.label}
                    {r.value === 'auto' && poll.suggestedMs ? <em> · now {every(poll.suggestedMs)}</em> : null}
                  </span>
                  {rate === r.value && <Check size={14} />}
                </button>
              ))}
            </div>
            <p className="pollmenu__note">Auto updates every 15s during games, 30s near tip-off and 2 min otherwise.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TeamPicker({ teams, favorite, setFavorite }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const current = teams.find((t) => t.id === favorite);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? teams.filter((t) => `${t.name} ${t.abbr}`.toLowerCase().includes(s)) : teams;
  }, [teams, q]);

  return (
    <div className="picker" ref={ref}>
      <button
        className={`picker__btn ${current ? '' : 'is-empty'}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={current ? `Your team: ${current.short}. Change team` : 'Rep your team'}
        style={teamVars(current)}
      >
        {current ? <TeamLogo team={current} size={22} /> : <Shield size={16} />}
        <span className="picker__label">{current ? current.short : 'Rep your team'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="picker__pop"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <div className="picker__head">
              <span>Pick a school — the whole site takes its colors</span>
              {current && (
                <button className="picker__clear" onClick={() => (setFavorite(null), setOpen(false))}>
                  <X size={13} /> Clear
                </button>
              )}
            </div>
            <label className="picker__search">
              <Search size={14} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams" />
            </label>
            <div className="picker__grid">
              {shown.map((t) => (
                <button
                  key={t.id}
                  className={`picker__team ${t.id === favorite ? 'is-on' : ''}`}
                  style={teamVars(t)}
                  onClick={() => {
                    setFavorite(t.id);
                    setOpen(false);
                  }}
                >
                  <TeamLogo team={t} size={34} />
                  <span>{t.short}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopBar({ teams, favorite, setFavorite, poll, mode, rate, setRate }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Players Era Live home">
        <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
          <path
            d="M12 14h12v12h10M12 50h12V38h10M34 26v12h18"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="52" cy="32" r="5" fill="var(--accent-2)" />
        </svg>
        <span className="brand__name">
          Players Era <b>Live</b>
        </span>
        <span className="brand__tag">Unofficial</span>
      </a>
      <div className="topbar__right">
        <PollStatus poll={poll} mode={mode} rate={rate} setRate={setRate} />
        <TeamPicker teams={teams} favorite={favorite} setFavorite={setFavorite} />
      </div>
    </header>
  );
}
