const VEGAS = 'America/Los_Angeles';

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const chipFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const longDayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const vegasDay = new Intl.DateTimeFormat('en-US', { timeZone: VEGAS, month: 'short', day: 'numeric' });
const vegasKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: VEGAS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const formatTime = (iso) => timeFmt.format(new Date(iso));
export const formatDay = (iso) => dayFmt.format(new Date(iso));
export const formatChip = (iso) => chipFmt.format(new Date(iso)).replace(',', '');
export const formatLongDay = (iso) => longDayFmt.format(new Date(iso));

// Local calendar day key, for grouping a schedule by the viewer's days.
export function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// "Nov 24–28" in Las Vegas time.
export function vegasRange(startIso, endIso) {
  if (!startIso) return '';
  const end = new Date(endIso);
  end.setHours(end.getHours() - 3); // late tips belong to the previous Vegas day
  const a = vegasDay.format(new Date(startIso));
  const b = vegasDay.format(end);
  if (a === b) return a;
  const [ma, da] = a.split(' ');
  const [mb, db] = b.split(' ');
  return ma === mb ? `${ma} ${da}–${db}` : `${a} – ${b}`;
}

export const isSameVegasDay = (a, b) => vegasKey.format(new Date(a)) === vegasKey.format(new Date(b));

export function countdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function statusLine(game) {
  if (!game) return 'TBD';
  const s = game.status;
  if (s.state === 'in') return s.shortDetail || 'Live';
  if (s.state === 'post') return s.shortDetail || 'Final';
  return `${formatDay(game.date)} · ${formatTime(game.date)}`;
}

export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th'}`;

export const shortVenue = (name) => (name || '').replace(/\s+Arena$/i, '');
