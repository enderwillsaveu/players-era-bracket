const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');
const { buildEvent } = require('../server/bracket');
const { pollPlan } = require('../server/tournament');
const { parseNote, kindFromLabel } = require('../server/normalize');
const fixture = require('./fixtures/games-2026-11-25.json');

// Snapshot from 2026-11-25: PE8 complete, PE16 after round one.
const games = () => structuredClone(fixture);
const cfg = (key) => config.events.find((e) => e.key === key);
const abbrs = (slot) => slot.sides.map((s) => (s.team ? s.team.abbr : null));
const byAbbrs = (list, a, b) =>
  list.find((g) => {
    const t = g.competitors.map((c) => c.team && c.team.abbr);
    return t.includes(a) && t.includes(b);
  });
const byLabel = (list, venueName, label) =>
  list.find((g) => g.venue.name.startsWith(venueName) && g.label && g.label.includes(label));

function finish(game, winner, loser, ws = 80, ls = 70) {
  game.status = { ...game.status, state: 'post', completed: true, shortDetail: 'Final', detail: 'Final' };
  for (const c of game.competitors) {
    if (!c.team) continue;
    c.winner = c.team.abbr === winner;
    c.score = c.team.abbr === winner ? ws : ls;
  }
  return game;
}

// Fill a TBD game with real teams, in the given (ESPN) order.
function fill(game, list, ...teamAbbrs) {
  const teams = new Map();
  for (const g of list) for (const c of g.competitors) if (c.team) teams.set(c.team.abbr, c.team);
  game.competitors.forEach((c, i) => {
    c.team = teams.get(teamAbbrs[i]);
  });
  return game;
}

test('note parsing', () => {
  assert.deepEqual(parseNote('Players Era 16 - Bracket Final'), { event: 'Players Era 16', label: 'Bracket Final' });
  assert.deepEqual(parseNote('Players Era 8'), { event: 'Players Era 8', label: null });
  assert.equal(kindFromLabel('Seventh Place Game'), 'seventh');
  assert.equal(kindFromLabel('Bracket Final'), 'final');
  assert.equal(kindFromLabel('Championship'), 'championship');
  assert.equal(kindFromLabel(null), 'round');
});

test('Players Era 8: full bracket and placements from real results', () => {
  const ev = buildEvent(cfg('pe8'), games());
  assert.equal(ev.brackets.length, 1);
  assert.equal(ev.championship, null);
  const { slots, placements } = ev.brackets[0];
  assert.deepEqual(slots.sf.map(abbrs), [['HOU', 'FLA'], ['KU', 'WVU']]);
  assert.deepEqual(slots.csf.map(abbrs), [['RUTG', 'ND'], ['UNLV', 'AUB']]);
  assert.equal(slots.final.title, 'Championship');
  assert.equal(ev.champion.abbr, 'HOU');
  assert.equal(ev.runnerUp.abbr, 'KU');
  assert.deepEqual(
    placements.map((p) => p.team.abbr),
    ['HOU', 'KU', 'FLA', 'WVU', 'ND', 'AUB', 'RUTG', 'UNLV'],
  );
  assert.deepEqual(ev.records[ev.champion.id], { w: 3, l: 0 });
});

test('Players Era 16: two brackets split by arena with inferred pairings', () => {
  const ev = buildEvent(cfg('pe16'), games());
  assert.deepEqual(
    ev.brackets.map((b) => b.name),
    ['Michelob ULTRA Bracket', 'T-Mobile Bracket'],
  );
  const [mich, tmo] = ev.brackets;
  assert.deepEqual(mich.slots.sf.map(abbrs), [['TENN', 'ISU'], ['LOU', 'SJU']]);
  assert.deepEqual(mich.slots.csf.map(abbrs), [['MD', 'SDSU'], ['TTU', 'ORE']]);
  assert.deepEqual(tmo.slots.sf.map(abbrs), [['TCU', 'CREI'], ['BAY', 'GONZ']]);
  assert.equal(mich.slots.final.sides[0].label, 'Winner TENN/ISU');
  assert.equal(ev.championship.sides[0].label, 'Michelob ULTRA Bracket winner');
  assert.equal(ev.champion, null);
});

test('finished feeders project teams into TBD slots', () => {
  const list = games();
  finish(byAbbrs(list, 'TENN', 'ISU'), 'ISU', 'TENN');
  const ev = buildEvent(cfg('pe16'), list);
  const { final, third } = ev.brackets[0].slots;
  assert.equal(final.sides[0].team.abbr, 'ISU');
  assert.equal(final.sides[0].projected, true);
  assert.equal(final.sides[0].score, null);
  assert.equal(final.sides[1].team, null);
  assert.equal(final.sides[1].label, 'Winner LOU/SJU');
  assert.equal(third.sides[0].team.abbr, 'TENN');
});

test('real competitors are ordered to match their feeder side', () => {
  const list = games();
  finish(byAbbrs(list, 'TENN', 'ISU'), 'TENN', 'ISU');
  finish(byAbbrs(list, 'LOU', 'SJU'), 'SJU', 'LOU');
  // ESPN lists the SF2 winner first; bracket must still put SF1's winner on top.
  fill(byLabel(list, 'Michelob', 'Bracket Final'), list, 'SJU', 'TENN');
  const { final } = buildEvent(cfg('pe16'), list).brackets[0].slots;
  assert.deepEqual(abbrs(final), ['TENN', 'SJU']);
  assert.ok(final.sides.every((s) => !s.projected));
});

test('championship crowns a champion once both brackets finish', () => {
  const list = games();
  const champ = list.find((g) => g.kind === 'championship');
  fill(champ, list, 'GONZ', 'TENN');
  finish(champ, 'GONZ', 'TENN', 77, 75);
  const ev = buildEvent(cfg('pe16'), list);
  assert.equal(ev.champion.abbr, 'GONZ');
  assert.equal(ev.runnerUp.abbr, 'TENN');
});

test('a game moved to the other arena stays in its own bracket', () => {
  const list = games();
  const g = byAbbrs(list, 'MD', 'SDSU');
  const tmobile = list.find((x) => x.venue.name.startsWith('T-Mobile')).venue;
  g.venue = { ...tmobile };
  const ev = buildEvent(cfg('pe16'), list);
  assert.deepEqual(abbrs(ev.brackets[0].slots.csf[0]), ['MD', 'SDSU']);
  assert.equal(ev.brackets[1].slots.csf.filter((s) => s.game).length, 2);
});

test('poll plan speeds up for live and imminent games', () => {
  const now = Date.parse('2026-11-26T17:50:00Z');
  const list = games();
  assert.equal(pollPlan(list, now).mode, 'soon');
  assert.equal(pollPlan(list, Date.parse('2026-11-25T20:00:00Z')).mode, 'idle');
  byAbbrs(list, 'MD', 'SDSU').status.state = 'in';
  assert.equal(pollPlan(list, now).mode, 'live');
  for (const g of list) g.status.state = 'post';
  assert.equal(pollPlan(list, now).mode, 'done');
});
