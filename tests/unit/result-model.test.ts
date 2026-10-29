import { expect, test } from 'vitest';
import type { HudState } from '../../apps/show/src/hud/hud';
import { registry } from '../../apps/show/src/games/registry';
import { roundResult, cupResult } from '../../apps/show/src/show-layer/result-model';

function state(): HudState {
  return {
    game: registry.get('peg-fever')!, phase: 'RESULT', timeLeft: 6, practice: true,
    streamerName: 'TestCaster', mode: 'cvs', paused: false, participants: 2, crowd: 0,
    cup: { round: 1, rounds: 5, chat: 0, streamer: 0, teams: {} },
    noWagers: true, connected: false, modifiers: [], wheel: [], votes: [], autopilot: true,
    safeZone: { x: 0, y: 0, w: 0, h: 0 }, showSafeZone: false, cupMvps: [],
    participantNames: { p0: 'Winner', p1: 'Runner' },
    result: { winner: { kind: 'chat' }, champion: { userId: 'p0', displayName: 'Winner', reason: 'Highest score' },
      mvps: [], highlights: [], perUser: { p0: { score: 2400, tags: ['place:1'] }, p1: { score: 1800, tags: ['place:2'] } },
      replay: { seed: 1, inputs: [] } },
    show: { round: 1, rounds: 5, phaseTime: 1, grandFinal: false,
      standings: [], qualified: [], question: '', stages: [], stageIndex: 0, elapsed: 60, notifications: [],
      podium: [{ userId: 'p0', login: 'winner', displayName: 'Winner', points: 10, place: 1, won: true, reason: 'PLACE 1' }] }
  };
}

test('offline results show real game points and never present Cup bonuses', () => {
  const input = state();
  const result = roundResult(input);
  expect(result.name).toBe('Winner');
  expect(result.stat).toBe('2,400 pts');
  expect(result.rows[0].cupPoints).toBeUndefined();
  input.practice = false;
  expect(roundResult(input).rows[0].cupPoints).toBe(10);
  expect(roundResult(input).rows[1].cupPoints).toBeUndefined();
});

test('team standings use actual finishers, promote the declared winner and preserve the result', () => {
  const input = state();
  input.game = registry.get('multiplier-cascade')!;
  input.mode = 'faction';
  input.result!.winner = { kind: 'team', teamId: 'blue' };
  input.result!.champion = undefined;
  input.result!.standings = [
    { teamId: 'red', score: 4, stat: '4 / 5 FINISHERS' },
    { teamId: 'blue', score: 5, stat: '5 / 5 FINISHERS' }
  ];
  const original = structuredClone(input.result);
  const result = roundResult(input);
  expect(result.winnerId).toBe('blue');
  expect(result.name).toContain('BLUE');
  expect(result.rows.map(row => row.value)).toEqual(['5 / 5 FINISHERS', '4 / 5 FINISHERS']);
  expect(result.rows.every(row => row.cupPoints === undefined)).toBe(true);
  expect(input.result).toEqual(original);
});

test('faction combat without supplied team standings still names the winning team correctly', () => {
  const input = state();
  input.game = registry.get('blade-brawl')!;
  input.mode = 'faction';
  input.result!.winner = { kind: 'team', teamId: 'blue' };
  input.result!.champion = undefined;
  const result = roundResult(input);
  expect(result.name).toContain('BLUE');
  expect(result.name).not.toBe('CHAT');
});

test('the actual streamer side wins even if a stale individual champion is supplied', () => {
  const input = state();
  input.game = registry.get('blade-brawl')!;
  input.result!.winner = { kind: 'streamer' };
  expect(roundResult(input).name).toBe('TestCaster');
  expect(roundResult(input).rowsTitle).toBe('MOST HITS');
  expect(roundResult(input).winnerId).toBe('streamer');
});

test('race finish times and finisher count have no fabricated default Cup point', () => {
  const input = state();
  input.game = registry.get('marble-race')!;
  input.practice = false;
  input.show!.podium = [];
  input.show!.raceSummary = { finished: 1, total: 2,
    podium: [{ id: 'p0', name: 'Winner', place: 1, time: 52.345 }] };
  const result = roundResult(input);
  expect(result.rows[0].value).toBe('52.34s');
  expect(result.rows[0].cupPoints).toBeUndefined();
  expect(result.note).toBe('1 / 2 marbles finished');
});

test('cancelled rounds have no podium, winner portrait or imaginary payout', () => {
  const input = state();
  input.result!.winner = { kind: 'void', reason: 'No entrants' };
  const result = roundResult(input);
  expect(result.cancelled).toBe(true);
  expect(result.rows).toEqual([]);
  expect(result.message).toBe('No entrants');
  expect(result.name).toBe('ROUND CANCELLED');
});

test('the Grand Final winner stays champion even when someone else leads Cup points', () => {
  const input = state();
  input.show!.standings = Array.from({ length: 8 }, (_, index) => ({
    userId: `p${index}`, displayName: `Player ${index}`, points: 100 - index * 5,
    rank: index + 1, previousRank: index + 1, color: '#ff4f7b', wins: 1, level: 1, title: '', crowned: false
  }));
  input.show!.championId = 'p7';
  const model = cupResult(input);
  expect(model.name).toBe('Player 7');
  expect(model.stat).toContain('65 CUP POINTS');
  expect(model.rows[0].name).toBe('Player 0');
  expect(model.rows.find(row => row.id === 'p7')?.rank).toBe(8);
  input.show!.championId = undefined;
  expect(cupResult(input).cancelled).toBe(true);
});


test('all supplied awards are displayed accurately; unknown places are left unranked', () => {
  const input = state();
  input.practice = false;
  input.show!.roundAwards = [...input.show!.podium,
    { userId: 'p1', login: 'runner', displayName: 'Runner', points: 7, place: 2, won: false, reason: 'PLACE 2' }];
  expect(roundResult(input).rows[1].cupPoints).toBe(7);
  input.show!.roundAwards = [];
  input.result!.perUser.p1.tags = [];
  expect(roundResult(input).rows[1].rank).toBeUndefined();
});


test('collective combat statistics rank actual hits separately from Cup placement', () => {
  const input = state();
  input.game = registry.get('blade-brawl')!;
  input.practice = false;
  input.result!.champion = undefined;
  input.result!.perUser = { p0: { score: 2, tags: ['survived'] }, p1: { score: 30, tags: [] } };
  const model = roundResult(input);
  expect(model.name).toBe('CHAT');
  expect(model.rowsTitle).toBe('MOST HITS');
  expect(model.rows.map(row => [row.name, row.rank, row.value]))
    .toEqual([['Runner', 1, '30 hits'], ['Winner', 2, '2 hits']]);
  expect(model.rows.find(row => row.id === 'p0')?.cupPoints).toBe(10);
});
