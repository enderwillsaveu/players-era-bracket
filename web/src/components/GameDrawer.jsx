import { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { ExternalLink, MapPin, Tv, Users, X } from 'lucide-react';
import { usePolling, useNow } from '../lib/usePolling';
import { palette, teamVars } from '../lib/colors';
import { countdown, formatLongDay, formatTime } from '../lib/format';
import { TeamLogo } from './TeamLogo';
import { StatusChip } from './GameCard';

const intervalOf = (d) => (d.status.state === 'in' ? 15000 : d.status.state === 'pre' ? 60000 : 600000);

function WinProb({ points, top, bottom, topIsHome }) {
  if (!points || points.length < 2) return null;
  const W = 600;
  const H = 140;
  const ys = points.map((p) => (topIsHome ? p.home : 1 - p.home));
  const x = (i) => (i / (points.length - 1)) * W;
  const y = (v) => (1 - v) * H;
  const line = ys.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H / 2} L0,${H / 2} Z`;
  const half = points.findIndex((p) => p.period === 2);
  const pt = palette(top);
  const pb = palette(bottom);
  const last = ys[ys.length - 1];
  return (
    <section className="dsec">
      <h4>Win probability</h4>
      <div className="wp">
        <div className="wp__labels">
          <span style={{ color: pt.accent }}>
            {top.abbr} {Math.round(last * 100)}%
          </span>
          <span style={{ color: pb.accent }}>
            {bottom.abbr} {Math.round((1 - last) * 100)}%
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="wp__svg" role="img" aria-label="Win probability over the game">
          <defs>
            <clipPath id="wp-top">
              <rect x="0" y="0" width={W} height={H / 2} />
            </clipPath>
            <clipPath id="wp-bot">
              <rect x="0" y={H / 2} width={W} height={H / 2} />
            </clipPath>
          </defs>
          <path d={area} fill={pt.accent} opacity="0.35" clipPath="url(#wp-top)" />
          <path d={area} fill={pb.accent} opacity="0.35" clipPath="url(#wp-bot)" />
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="wp__mid" />
          {half > 0 && <line x1={x(half)} x2={x(half)} y1="0" y2={H} className="wp__half" />}
          <path d={line} fill="none" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="wp__axis">
          <span>Tip</span>
          {half > 0 && <span style={{ left: `${(half / (points.length - 1)) * 100}%` }}>Half</span>}
          <span>{points.length ? 'Now' : ''}</span>
        </div>
      </div>
    </section>
  );
}

const STAT_ROWS = [
  ['fgPct', 'Field goal %', 'fg', true],
  ['threePct', '3-point %', 'three', true],
  ['ftPct', 'Free throw %', 'ft', true],
  ['reb', 'Rebounds'],
  ['oreb', 'Offensive reb.'],
  ['ast', 'Assists'],
  ['to', 'Turnovers', null, false, true],
  ['stl', 'Steals'],
  ['blk', 'Blocks'],
  ['paint', 'Points in paint'],
  ['fastBreak', 'Fast break pts'],
  ['largestLead', 'Largest lead'],
];

function StatCompare({ a, b }) {
  if (!a.stats || !b.stats) return null;
  const pa = palette(a.team);
  const pb = palette(b.team);
  return (
    <section className="dsec">
      <h4>Team stats</h4>
      <div className="stats">
        {STAT_ROWS.map(([key, label, detail, pct, lowerBetter]) => {
          const va = Number(a.stats[key]);
          const vb = Number(b.stats[key]);
          if (Number.isNaN(va) || Number.isNaN(vb)) return null;
          const total = va + vb || 1;
          const aWins = lowerBetter ? va < vb : va > vb;
          const bWins = lowerBetter ? vb < va : vb > va;
          return (
            <div className="stat" key={key}>
              <span className={`stat__v ${aWins ? 'is-lead' : ''}`}>
                {a.stats[key]}
                {pct && '%'}
                {detail && <small>{a.stats[detail]}</small>}
              </span>
              <span className="stat__label">{label}</span>
              <span className={`stat__v stat__v--r ${bWins ? 'is-lead' : ''}`}>
                {b.stats[key]}
                {pct && '%'}
                {detail && <small>{b.stats[detail]}</small>}
              </span>
              <div className="stat__bar">
                <motion.span
                  style={{ background: pa.accent, opacity: aWins ? 1 : 0.4 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(va / total) * 100}%` }}
                  transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                />
                <motion.span
                  style={{ background: pb.accent, opacity: bWins ? 1 : 0.4 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(vb / total) * 100}%` }}
                  transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Leaders({ teams }) {
  if (!teams.some((t) => t.leaders.length)) return null;
  return (
    <section className="dsec">
      <h4>Leaders</h4>
      <div className="leaders">
        {teams.map((t) => (
          <div className="leaders__team" key={t.team.id} style={teamVars(t.team)}>
            {t.leaders.map((l) => (
              <div className="leader" key={l.category}>
                <div className="leader__shot">
                  {l.headshot ? <img src={l.headshot} alt="" loading="lazy" /> : <TeamLogo team={t.team} size={40} />}
                </div>
                <div className="leader__body">
                  <span className="leader__val">
                    {l.value}
                    <small>{l.category === 'points' ? 'PTS' : l.category === 'rebounds' ? 'REB' : 'AST'}</small>
                  </span>
                  <span className="leader__name">
                    {l.short}
                    {l.jersey && <em> #{l.jersey}</em>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function LineScore({ teams }) {
  const periods = Math.max(...teams.map((t) => t.linescores.length));
  if (!periods) return null;
  const head = Array.from({ length: periods }, (_, i) => (i < 2 ? `${i + 1}H` : `OT${i > 2 ? i - 1 : ''}`));
  return (
    <section className="dsec">
      <table className="linescore">
        <thead>
          <tr>
            <th />
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
            <th>T</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.team.id} className={t.winner ? 'is-winner' : ''}>
              <td>
                <span className="linescore__team" style={teamVars(t.team)}>
                  <TeamLogo team={t.team} size={18} /> {t.team.abbr}
                </span>
              </td>
              {head.map((h, i) => (
                <td key={h}>{t.linescores[i] ?? '–'}</td>
              ))}
              <td className="linescore__total">{t.score ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PreGame({ slot, records, now }) {
  const g = slot.game;
  const ms = new Date(g.date).getTime() - now;
  return (
    <section className="dsec pregame">
      <div className="pregame__count">
        <span>Tip-off in</span>
        <strong>{countdown(ms)}</strong>
      </div>
      <div className="pregame__rows">
        {slot.sides.map((s, i) =>
          s.team ? (
            <div key={i} className="pregame__row" style={teamVars(s.team)}>
              <TeamLogo team={s.team} size={22} />
              <span>{s.team.name}</span>
              <span className="pregame__rec">
                {records[s.team.id] ? `${records[s.team.id].w}-${records[s.team.id].l} in Vegas` : ''}
                {s.record ? ` · ${s.record} overall` : ''}
              </span>
            </div>
          ) : (
            <div key={i} className="pregame__row pregame__row--tbd">
              {s.label}
            </div>
          ),
        )}
      </div>
    </section>
  );
}

export function GameDrawer({ slot, event, onClose }) {
  const now = useNow(1000);
  const g = slot.game;
  const { data, error } = usePolling(`/api/game/${g.id}`, { intervalOf, fallbackMs: 60000 });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Keep bracket order (top/bottom) for the summary's teams.
  const teams = useMemo(() => {
    if (!data) return null;
    const order = slot.sides.map((s) => s.team && s.team.id);
    return [...data.teams].sort((x, y) => order.indexOf(x.team && x.team.id) - order.indexOf(y.team && y.team.id));
  }, [data, slot]);

  const sides = teams || slot.sides;
  const [a, b] = sides;
  const state = (data ? data.status : g.status).state;
  const status = data ? { ...g, status: data.status } : g;
  const odds = (data && data.odds) || g.odds;
  const pa = a.team && palette(a.team);
  const pb = b.team && palette(b.team);

  return (
    <motion.div className="drawer-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="drawer-scrim" onClick={onClose} />
      <motion.aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${slot.title} game details`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <header
          className="dhead"
          style={{
            '--ca': pa ? pa.primary : '#222',
            '--cb': pb ? pb.primary : '#222',
          }}
        >
          <button className="iconbtn dhead__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
          <div className="dhead__kicker">
            {event.name} · {slot.title}
          </div>
          <div className="dhead__match">
            {[a, b].map((s, i) => (
              <div key={i} className={`dteam ${state === 'post' && !s.winner ? 'is-loser' : ''}`}>
                {s.team ? <TeamLogo team={s.team} size={64} /> : <span className="logo logo--empty" style={{ width: 64, height: 64 }} />}
                <span className="dteam__name">{s.team ? s.team.short : s.label}</span>
                <span className="dteam__rec">{s.record || ''}</span>
              </div>
            ))}
            <div className="dhead__score">
              {state === 'pre' ? (
                <span className="dhead__vs">VS</span>
              ) : (
                <span>
                  {a.score ?? '–'}
                  <i>–</i>
                  {b.score ?? '–'}
                </span>
              )}
              <StatusChip game={status} />
            </div>
          </div>
        </header>

        <div className="dbody">
          {error && !data && <p className="notice">Couldn’t load game details: {error}</p>}
          {state === 'pre' && <PreGame slot={slot} records={event.records} now={now} />}
          {teams && state !== 'pre' && <LineScore teams={teams} />}
          {data && a.team && b.team && (
            <WinProb points={data.winProb} top={a.team} bottom={b.team} topIsHome={a.homeAway === 'home'} />
          )}
          {teams && state !== 'pre' && <StatCompare a={teams[0]} b={teams[1]} />}
          {teams && <Leaders teams={teams} />}

          <section className="dsec info">
            <div>
              <MapPin size={15} />
              {(data && data.venue) || (g.venue && g.venue.name)} · Las Vegas
            </div>
            <div>
              <Tv size={15} />
              {(data && data.broadcast) || g.broadcast || 'TBA'} · {formatLongDay(g.date)}, {formatTime(g.date)}
            </div>
            {data && data.attendance && (
              <div>
                <Users size={15} />
                {data.attendance.toLocaleString()} in attendance
              </div>
            )}
            {state === 'pre' && odds && odds.details && (
              <div className="info__odds">
                Line: {odds.details}
                {odds.overUnder ? ` · O/U ${odds.overUnder}` : ''}
              </div>
            )}
            <a
              className="info__link"
              href={`https://www.espn.com/mens-college-basketball/game/_/gameId/${g.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Full game on ESPN <ExternalLink size={14} />
            </a>
          </section>
        </div>
      </motion.aside>
    </motion.div>
  );
}
