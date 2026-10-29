import type { Message, RoundResult, UserStats, TeamId } from '@chaos/shared';
import type { JsonStore } from './storage';
export const TITLES: { name: string; check: (u: UserStats) => boolean }[] = [
  { name: 'First Shift', check: u => u.rounds >= 1 }, { name: 'Factory Regular', check: u => u.rounds >= 10 },
  { name: 'Night Shift', check: u => u.rounds >= 50 }, { name: 'Chaos Veteran', check: u => u.rounds >= 100 },
  { name: 'Winner Winner', check: u => u.wins >= 1 }, { name: 'Victory Lap', check: u => u.wins >= 10 },
  { name: 'Unstoppable', check: u => u.wins >= 50 }, { name: 'Name in Lights', check: u => u.mvps >= 1 },
  { name: 'Main Character', check: u => u.mvps >= 10 }, { name: 'Crusher of Kings', check: u => u.crushes >= 5 },
  { name: 'Unsinkable', check: u => u.survived >= 10 }, { name: 'Turncoat', check: u => u.traitors >= 1 },
  { name: 'Double Agent', check: u => u.traitors >= 5 }, { name: 'Point Magnet', check: u => u.score >= 1000 },
  { name: 'True Colors', check: u => Object.values(u.factions).some(n => (n ?? 0) >= 20) }
];
export class Stats {
  users: Record<string, UserStats> = Object.create(null); factions: Partial<Record<TeamId, number>> = {};
  private seen: string[] = []; history: { gameId: string; seed: number; winner: RoundResult['winner'] }[] = [];
  constructor(private store: JsonStore) {}
  async load(): Promise<void> { const data = await this.store.read('stats.json', { users: this.users, factions: this.factions, seen: this.seen, history: this.history }); Object.assign(this, data);this.users=Object.assign(Object.create(null),data.users); }
  async record(gameId: string, result: RoundResult,roundId?:string): Promise<void> {
    if(!/^[a-z][a-z0-9-]{0,63}$/.test(gameId)||roundId&&!/^[a-f0-9-]{36}$/i.test(roundId))throw new Error('Invalid round identity');
    const key = roundId??`${gameId}:${result.replay.seed}`; if (this.seen.includes(key)) return;
    this.seen.push(key); this.seen = this.seen.slice(-2000);
    for (const [id, row] of Object.entries(result.perUser)) {
      const u = this.users[id] ??= { login: id, rounds: 0, wins: 0, score: 0, mvps: 0, crushes: 0, survived: 0, traitors: 0, titles: [], factions: {} };
      u.rounds++; u.score += row.score; u.wins += Number(row.tags.includes('win'));
      u.mvps += Number(result.mvps.some(m => m.userId === id)); u.crushes += Number(row.tags.includes('crushed_streamer'));
      u.survived += Number(row.tags.includes('survived')); u.traitors += Number(row.tags.includes('traitor'));
      const team = row.tags.find(t => t.startsWith('team:'))?.slice(5) as TeamId | undefined;
      if (team) u.factions[team] = (u.factions[team] ?? 0) + 1;
      u.titles = TITLES.filter(t => t.check(u)).map(t => t.name);
    }
    if (result.winner.kind === 'team') this.factions[result.winner.teamId] = (this.factions[result.winner.teamId] ?? 0) + 3;
    this.history.push({ gameId, seed: result.replay.seed, winner: result.winner }); this.history = this.history.slice(-100);
    await this.store.write('stats.json', { users: this.users, factions: this.factions, seen: this.seen, history: this.history });
    await this.store.write(`replays/${gameId}-${result.replay.seed}${roundId?'-'+roundId:''}.json`, result);
    await this.store.trimReplays();
  }
  snapshot(): Extract<Message, { type: 'stats.snapshot' }> { return { type: 'stats.snapshot', users: Object.fromEntries(Object.entries(this.users).sort((a, b) => b[1].score - a[1].score).slice(0, 50)), factions: this.factions }; }
}
