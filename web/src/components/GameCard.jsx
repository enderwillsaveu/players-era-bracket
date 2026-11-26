import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { teamVars } from '../lib/colors';
import { formatChip, shortVenue } from '../lib/format';
import { hasTeam } from '../lib/bracket';
import { TeamLogo } from './TeamLogo';

const cx = (...c) => c.filter(Boolean).join(' ');

export function StatusChip({ game }) {
  if (!game) return <span className="chip chip--tbd">TBD</span>;
  const s = game.status;
  if (s.state === 'in') {
    return (
      <span className="chip chip--live">
        <span className="pulse-dot" />
        {s.name === 'STATUS_HALFTIME' ? 'HALF' : s.shortDetail.replace(/\s*-\s*/, ' · ')}
      </span>
    );
  }
  if (s.state === 'post') return <span className="chip chip--final">{s.shortDetail.toUpperCase()}</span>;
  return (
    <span className="chip chip--pre" title={new Date(game.date).toLocaleString()}>
      {formatChip(game.date)}
    </span>
  );
}

function Score({ value }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (prev.current != null && value != null && value !== prev.current) setFlash((n) => n + 1);
    prev.current = value;
  }, [value]);
  if (value == null) return <span className="row__score row__score--empty" />;
  return (
    <span className="row__score">
      {flash > 0 && <span key={flash} className="row__flash" />}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: -14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 14, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function TeamRow({ side, anchor, state, focus }) {
  const t = side.team;
  if (!t) {
    return (
      <div className="row row--tbd" data-anchor={anchor}>
        <span className="row__bar" />
        <span className="logo logo--empty" />
        <span className="row__label">{side.label || 'TBD'}</span>
      </div>
    );
  }
  const lost = state === 'post' && !side.winner;
  return (
    <div
      className={cx(
        'row',
        side.winner && 'is-winner',
        lost && 'is-loser',
        side.projected && 'is-projected',
        focus.favoriteId === t.id && 'is-fav',
        focus.hoverTeam === t.id && 'is-hot',
      )}
      style={teamVars(t)}
      data-anchor={anchor}
      onMouseEnter={() => focus.onHoverTeam(t.id)}
      onMouseLeave={() => focus.onHoverTeam(null)}
    >
      <span className="row__bar" />
      <TeamLogo team={t} size={24} />
      <span className="row__name">
        {side.rank && <span className="row__rank">{side.rank}</span>}
        {t.short}
        {side.projected && <span className="row__proj">ADV</span>}
      </span>
      <Score value={side.score} />
    </div>
  );
}

export function GameCard({ slot, focus, onOpen, variant = 'default', label }) {
  const g = slot.game;
  const state = g ? g.status.state : 'tbd';
  const involved = focus.hoverTeam && hasTeam(slot, focus.hoverTeam);
  const open = () => g && onOpen(slot);
  return (
    <div
      className={cx(
        'card',
        `card--${state}`,
        variant !== 'default' && `card--${variant}`,
        focus.hoverTeam && !involved && 'is-dim',
        focus.favoriteId && hasTeam(slot, focus.favoriteId) && 'is-fav',
        g && 'is-clickable',
      )}
      data-card={slot.id}
      role={g ? 'button' : undefined}
      tabIndex={g ? 0 : undefined}
      aria-label={g ? `${slot.title}: ${slot.sides.map((s) => (s.team ? s.team.short : s.label)).join(' vs ')}` : undefined}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
    >
      <div className="card__meta">
        <span className="card__round">{label || slot.title}</span>
        <StatusChip game={g} />
      </div>
      {slot.sides.map((side, i) => (
        <TeamRow key={i} side={side} anchor={`${slot.id}:${i}`} state={state} focus={focus} />
      ))}
      {variant === 'hero' && g && (
        <div className="card__foot">
          <span>{shortVenue(g.venue && g.venue.name)}</span>
          {g.broadcast && <span className="card__tv">{g.broadcast}</span>}
        </div>
      )}
    </div>
  );
}
