import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pause, Play, RefreshCw, Search, Shield, X } from 'lucide-react';
import { ago } from '../lib/format';
import { teamVars } from '../lib/colors';
import { TeamLogo } from './TeamLogo';

const MODE_LABEL = {
  live: 'Live',
  soon: 'Tip-off soon',
  idle: 'Between games',
  done: 'Final',
};

function PollStatus({ poll, mode, paused, setPaused, now }) {
  const total = poll.interval || 1;
  const left = poll.nextAt ? Math.max(0, poll.nextAt - now) : 0;
  const pct = poll.nextAt ? 1 - left / total : 0;
  const C = 2 * Math.PI * 8;
  return (
    <div className={`poll poll--${poll.error ? 'error' : mode}`}>
      <span className="poll__dot" />
      <div className="poll__text">
        <strong>{poll.error ? 'Reconnecting' : MODE_LABEL[mode] || 'Loading'}</strong>
        <span>
          {paused
            ? 'Auto-refresh paused'
            : poll.updatedAt
              ? `Updated ${ago(now - poll.updatedAt)} · every ${Math.round(total / 1000)}s`
              : 'Connecting…'}
        </span>
      </div>
      <button
        className="iconbtn poll__ring"
        onClick={poll.refresh}
        aria-label="Refresh now"
        title={poll.nextAt ? `Next refresh in ${Math.ceil(left / 1000)}s` : 'Refresh now'}
      >
        <svg viewBox="0 0 20 20" width="30" height="30">
          <circle cx="10" cy="10" r="8" className="poll__track" />
          <circle
            cx="10"
            cy="10"
            r="8"
            className="poll__prog"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
          />
        </svg>
        <RefreshCw size={13} className={poll.loading ? 'spin' : ''} />
      </button>
      <button
        className="iconbtn"
        onClick={() => setPaused(!paused)}
        aria-label={paused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
        title={paused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
    </div>
  );
}

function TeamPicker({ teams, favorite, setFavorite }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const current = teams.find((t) => t.id === favorite);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? teams.filter((t) => `${t.name} ${t.abbr}`.toLowerCase().includes(s)) : teams;
  }, [teams, q]);

  return (
    <div className="picker" ref={ref}>
      <button className="picker__btn" onClick={() => setOpen(!open)} aria-expanded={open} style={teamVars(current)}>
        {current ? <TeamLogo team={current} size={22} /> : <Shield size={16} />}
        <span>{current ? current.short : 'Rep your team'}</span>
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

export function TopBar({ teams, favorite, setFavorite, poll, mode, paused, setPaused, now }) {
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
        <PollStatus poll={poll} mode={mode} paused={paused} setPaused={setPaused} now={now} />
        <TeamPicker teams={teams} favorite={favorite} setFavorite={setFavorite} />
      </div>
    </header>
  );
}
