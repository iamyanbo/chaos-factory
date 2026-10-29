import { expect, test } from 'vitest';
import { Cup } from '../../apps/show/src/show-layer/cup';
import { placementPoints } from '../../apps/show/src/show-layer/placements';
import { Stages } from '../../apps/show/src/show-layer/stages';
import { newViewerProfile, stableViewerColor, type Participant, type RoundResult } from '@chaos/shared';

const roster: Participant[] = Array.from({ length: 16 }, (_, index) => ({
  userId: `p${index}`, login: `p${index}`, displayName: `Player${index}`,
  color: '#ffffff', teamId: index % 2 ? 'blue' : 'red'
}));
const result = (champion = 'p0'): RoundResult => ({
  winner: { kind: 'chat' }, champion: { userId: champion, displayName: champion, reason: 'LAST STANDING' },
  mvps: [], highlights: [], perUser: {}, replay: { seed: 1, inputs: [] }
});

test('placement points have the requested podium, quartile and participation values', () => {
  expect(Array.from({ length: 16 }, (_, index) => placementPoints(index + 1, 16)))
    .toEqual([10, 7, 5, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
});

test('Cup points use real elimination order and Grand Final survival overrides the points leader', () => {
  const cup = new Cup();
  cup.reset();
  for (let round = 1; round <= 4; round++) {
    cup.beginRound(roster, 'blade-brawl');
    for (const user of roster.slice(1).reverse()) cup.event({ t: 'elim', victim: user.userId, by: 'p0', cause: 'blade' });
    cup.settle('blade-brawl', round, result(), undefined, false, false);
  }
  expect(cup.standings()[0]).toMatchObject({ userId: 'p0', points: 40 });
  expect(cup.topEight()).toEqual(roster.slice(0, 8).map(user => user.userId));
  cup.beginRound(roster.slice(0, 8), 'blade-brawl');
  for (const user of roster.slice(0, 7)) cup.event({ t: 'elim', victim: user.userId, by: 'p7', cause: 'blade' });
  const record = cup.settle('blade-brawl', 5, result('p7'), undefined, false, false);
  expect(record.championId).toBe('p7');
  expect(cup.standings()[0].userId).toBe('p0');
  expect(cup.championId).toBe('p7');
});

test('factions award five to each winning member; voids award nothing', () => {
  const cup = new Cup();
  cup.reset();
  cup.beginRound(roster, 'pong-wars');
  const teamResult = { ...result(), champion: undefined, winner: { kind: 'team' as const, teamId: 'red' as const } };
  const record = cup.settle('pong-wars', 1, teamResult, undefined, true, false);
  expect(record.awards.filter(award => award.won)).toHaveLength(8);
  expect(record.awards.every(award => award.points === (award.won ? 5 : 1))).toBe(true);
  cup.beginRound(roster, 'pong-wars');
  const voidRecord = cup.settle('pong-wars', 2, { ...result(), winner: { kind: 'void', reason: 'tie' }, champion: undefined }, undefined, true, false);
  expect(voidRecord.awards.every(award => award.points === 0 && !award.won)).toBe(true);
});

test('crown bonus is once per round and repeated real eliminations announce the rivalry', () => {
  const cup = new Cup();
  cup.reset('p0');
  cup.beginRound(roster, 'blade-brawl');
  expect(cup.event({ t: 'elim', victim: 'p0', by: 'p1', cause: 'blade' })).toEqual(['@Player1 DETHRONED @Player0  +3']);
  expect(cup.event({ t: 'elim', victim: 'p0', by: 'p1', cause: 'blade' })).toEqual([]);
  const first = cup.settle('blade-brawl', 1, result('p1'), undefined, false, false);
  expect(first.awards.find(award => award.userId === 'p1')?.points).toBe(13);
  cup.beginRound(roster, 'blade-brawl');
  expect(cup.event({ t: 'elim', victim: 'p0', by: 'p1', cause: 'blade' }))
    .toEqual(['@Player1 got @Player0 AGAIN', '@Player1 DETHRONED @Player0  +3']);
});

test('race finishes and ownership changes dethrone actual admitted champions', () => {
  const cup = new Cup();
  cup.reset('p0');
  cup.beginRound(roster, 'marble-race');
  expect(cup.event({ t: 'finish', who: 'p1', place: 1 })[0]).toContain('DETHRONED');
  cup.beginRound(roster, 'pong-wars');
  expect(cup.event({ t: 'territory', by: 'p1', from: 'red', to: 'blue' })[0]).toContain('DETHRONED');
  expect(cup.event({ t: 'territory', by: 'p1', from: 'red', to: 'blue' })).toEqual([]);
});

test('stages follow real events, keep checkpoint timestamps and never rewind', () => {
  const stages = new Stages();
  stages.reset('ring-escape');
  stages.update(25, undefined);
  expect(stages.index).toBe(1);
  stages.update(30, undefined);
  expect(stages.rows[2]).toEqual({ name: 'RED ZONE', startedAt: 30 });
  stages.update(10, undefined);
  expect(stages.index).toBe(2);
  stages.reset('marble-race');
  stages.update(22, { inspect: () => ({ time: 22, keys: [], marbles: [],
    details: { checkpoints: [{ times: [2, 8, 17, 22] }] } }) } as never);
  expect(stages.rows[1].startedAt).toBe(22);
});

test('profile colors are stable independently of game seed or roster order', () => {
  const profile = newViewerProfile(roster[0]);
  expect(profile.color).toBe(stableViewerColor('p0'));
  const recolored = { ...roster[0], color: '#ff0000' };
  expect(newViewerProfile(recolored).color).toBe(profile.color);
  expect(profile).toMatchObject({ level: 1, xp: 0, wins: 0, cupsWon: 0 });
});
