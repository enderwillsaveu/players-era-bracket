import { useMemo } from 'react';
import { motion } from 'motion/react';
import { byTip, gameSlots, hasTeam } from '../lib/bracket';
import { dayKey, formatLongDay, formatTime, shortVenue } from '../lib/format';
import { teamVars } from '../lib/colors';
import { TeamLogo } from './TeamLogo';
import { StatusChip } from './GameCard';

function Side({ side, state }) {
  if (!side.team) return <span className="srow__team srow__team--tbd">{side.label}</span>;
  return (
    <span className={`srow__team ${state === 'post' && !side.winner ? 'is-loser' : ''}`} style={teamVars(side.team)}>
      <TeamLogo team={side.team} size={26} />
      <span className="srow__name">
        {side.rank && <small>{side.rank}</small>}
        {side.team.short}
        {side.projected && <em>ADV</em>}
      </span>
      {side.score != null && <b>{side.score}</b>}
    </span>
  );
}

export function Schedule({ event, focus, onOpen }) {
  const days = useMemo(() => {
    const groups = new Map();
    for (const s of gameSlots(event).sort(byTip)) {
      const k = dayKey(s.game.date);
      if (!groups.has(k)) groups.set(k, { date: s.game.date, slots: [] });
      groups.get(k).slots.push(s);
    }
    return [...groups.values()];
  }, [event]);

  return (
    <div className="schedule">
      {days.map((d, di) => (
        <motion.section
          key={d.date}
          className="sday"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: di * 0.05 }}
        >
          <h3 className="sday__head">{formatLongDay(d.date)}</h3>
          {d.slots.map((s) => (
            <button
              key={s.id}
              className={`srow srow--${s.game.status.state} ${focus.favoriteId && hasTeam(s, focus.favoriteId) ? 'is-fav' : ''}`}
              onClick={() => onOpen(s)}
            >
              <span className="srow__time">
                {s.game.status.state === 'pre' ? formatTime(s.game.date) : <StatusChip game={s.game} />}
              </span>
              <span className="srow__match">
                <Side side={s.sides[0]} state={s.game.status.state} />
                <Side side={s.sides[1]} state={s.game.status.state} />
              </span>
              <span className="srow__meta">
                <b>{s.title}</b>
                <span>
                  {shortVenue(s.game.venue && s.game.venue.name)}
                  {s.game.broadcast ? ` · ${s.game.broadcast}` : ''}
                </span>
              </span>
            </button>
          ))}
        </motion.section>
      ))}
    </div>
  );
}
