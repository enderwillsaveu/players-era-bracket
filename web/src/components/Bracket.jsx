import { useMemo, useRef } from 'react';
import { Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { GameCard } from './GameCard';
import { Connectors, winnerEdges } from './Connectors';
import { TeamLogo } from './TeamLogo';
import { teamVars } from '../lib/colors';
import { formatDay, shortVenue } from '../lib/format';

function roundDay(slots) {
  const dates = slots.filter((s) => s.game).map((s) => s.game.date).sort();
  return dates.length ? formatDay(dates[0]) : '';
}

function Column({ title, slots, focus, onOpen, className = '' }) {
  return (
    <div className={`col ${className}`}>
      <div className="col__head">
        <span>{title}</span>
        <span className="col__day">{roundDay(slots)}</span>
      </div>
      <div className="col__body">
        {slots.map((s) => (
          <GameCard key={s.id} slot={s} focus={focus} onOpen={onOpen} label={s.short} />
        ))}
      </div>
    </div>
  );
}

function Tree({ bracket, dir, finalSlot, focus, onOpen }) {
  const { qf, sf } = bracket.slots;
  return (
    <div className={`tree tree--${dir}`}>
      <div className="tree__label" style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
        <span className="tree__name">{bracket.name}</span>
        <span className="tree__venue">{bracket.venue}</span>
      </div>
      <div className="tree__cols">
        <Column title="Quarterfinals" slots={qf} focus={focus} onOpen={onOpen} />
        <Column title="Semifinals" slots={sf} focus={focus} onOpen={onOpen} />
        <Column title={finalSlot.title} slots={[finalSlot]} focus={focus} onOpen={onOpen} className="col--final" />
      </div>
    </div>
  );
}

function ChampionPlate({ champion, title }) {
  if (!champion) {
    return (
      <div className="plate plate--empty">
        <Trophy size={30} strokeWidth={1.4} />
        <span>{title}</span>
        <strong>To be crowned</strong>
      </div>
    );
  }
  return (
    <motion.div
      className="plate"
      style={teamVars(champion)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
    >
      <div className="plate__glow" />
      <TeamLogo team={champion} size={88} />
      <span className="plate__kicker">
        <Trophy size={14} /> Champions
      </span>
      <strong className="plate__name">{champion.short}</strong>
      <span className="plate__mascot">{champion.mascot}</span>
    </motion.div>
  );
}

function CenterColumn({ event, focus, onOpen }) {
  const slot = event.championship;
  return (
    <div className="center">
      <div className="center__head">
        <Trophy size={18} />
        <span>Championship</span>
        {slot.game && <span className="col__day">{formatDay(slot.game.date)}</span>}
      </div>
      <ChampionPlate champion={event.champion} title={event.name} />
      <GameCard slot={slot} focus={focus} onOpen={onOpen} variant="hero" label="Title game" />
    </div>
  );
}

function Placement({ bracket, focus, onOpen }) {
  const ref = useRef(null);
  const { csf, fifth, third, seventh } = bracket.slots;
  const edges = useMemo(() => winnerEdges([fifth]), [fifth]);
  return (
    <section className="placement">
      <header className="placement__head">
        <span className="tree__name">{bracket.name}</span>
        <span className="placement__sub">Placement games · {shortVenue(bracket.venue)}</span>
      </header>
      <div className="placement__grid" ref={ref}>
        <Connectors containerRef={ref} edges={edges} focus={focus} />
        <div className="placement__col placement__col--csf">
          {csf.map((s) => (
            <GameCard key={s.id} slot={s} focus={focus} onOpen={onOpen} />
          ))}
        </div>
        <div className="placement__col placement__col--mid">
          <GameCard slot={fifth} focus={focus} onOpen={onOpen} />
        </div>
        <div className="placement__col placement__col--side">
          <GameCard slot={third} focus={focus} onOpen={onOpen} />
          <GameCard slot={seventh} focus={focus} onOpen={onOpen} />
        </div>
      </div>
    </section>
  );
}

export function EventBracket({ event, focus, onOpen }) {
  const ref = useRef(null);
  const two = event.brackets.length > 1 && event.championship;
  const [A, B] = event.brackets;

  const edges = useMemo(() => {
    const slots = event.brackets.flatMap((b) => [...b.slots.sf, b.slots.final]);
    if (event.championship) slots.push(event.championship);
    return winnerEdges(slots);
  }, [event]);

  if (!A) return <p className="empty">No games found for {event.name} yet.</p>;

  return (
    <div className="bracket">
      <div className="bracket__scroll">
        <div className={`bracket__canvas ${two ? 'is-two' : 'is-one'}`} ref={ref}>
          <Connectors containerRef={ref} edges={edges} focus={focus} />
          <Tree bracket={A} dir="ltr" finalSlot={A.slots.final} focus={focus} onOpen={onOpen} />
          {two ? (
            <>
              <CenterColumn event={event} focus={focus} onOpen={onOpen} />
              <Tree bracket={B} dir="rtl" finalSlot={B.slots.final} focus={focus} onOpen={onOpen} />
            </>
          ) : (
            <div className="center center--solo">
              <div className="center__head">
                <Trophy size={18} />
                <span>Champion</span>
              </div>
              <ChampionPlate champion={event.champion} title={event.name} />
            </div>
          )}
        </div>
      </div>
      <div className={`placements ${two ? 'is-two' : ''}`}>
        {event.brackets.map((b) => (
          <Placement key={b.key} bracket={b} focus={focus} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
