import { newViewerProfile, roundWinnerLabel, type CupRoundRecord, type CupStanding, type GameEvent,
  type Participant, type RoundAward, type RoundResult, type ViewerProfile } from '@chaos/shared';
import type { GameInstance } from '../games/contract';
import { placementOrder, placementPoints } from './placements';

interface Entry {
  member: Participant;
  points: number;
  wins: number;
  joined: number;
}

/** Show-only identity and stakes. This class never alters a game's simulation. */
export class Cup {
  id = '';
  streamerName = 'Streamer';
  championId?: string;
  crownUserId?: string;
  awards: RoundAward[] = [];
  previousRanks = new Map<string, number>();
  lastWinners: Record<string, string> = {};
  private entries = new Map<string, Entry>();
  private eliminated: string[] = [];
  private finished: string[] = [];
  private rivalries = new Map<string, number>();
  private bonuses = new Map<string, number>();
  private dethroned = false;
  private roundRoster: Participant[] = [];
  private gameId = '';

  reset(crownUserId?: string): void {
    this.id = crypto.randomUUID();
    this.championId = undefined;
    this.crownUserId = crownUserId;
    this.awards = [];
    this.entries.clear();
    this.previousRanks.clear();
    this.rivalries.clear();
  }

  beginRound(roster: Participant[], gameId = ''): void {
    this.roundRoster = roster;
    this.gameId = gameId;
    this.eliminated = [];
    this.finished = [];
    this.bonuses.clear();
    this.dethroned = false;
    this.awards = [];
    this.previousRanks = new Map(this.ordered().map((entry, index) => [entry.member.userId, index + 1]));
    for (const member of roster) {
      if (!this.entries.has(member.userId)) this.entries.set(member.userId, {
        member, points: 0, wins: 0, joined: this.entries.size
      });
      else this.entries.get(member.userId)!.member = member;
      if (!this.previousRanks.has(member.userId)) this.previousRanks.set(member.userId, this.entries.get(member.userId)!.joined + 1);
    }
  }

  private ordered(): Entry[] {
    return [...this.entries.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.joined - b.joined);
  }

  topEight(): string[] { return this.ordered().slice(0, 8).map(entry => entry.member.userId); }

  standings(profiles: Record<string, ViewerProfile> = {}): CupStanding[] {
    return this.ordered().map((entry, index) => {
      const user = entry.member;
      const profile = profiles[user.userId] ?? newViewerProfile(user);
      return { userId: user.userId, displayName: user.displayName, color: profile.color,
        points: entry.points, wins: entry.wins, rank: index + 1,
        previousRank: this.previousRanks.get(user.userId) ?? index + 1,
        level: profile.level, title: profile.title, crowned: user.userId === this.crownUserId };
    });
  }

  name(id: string): string {
    if (id === 'streamer') return this.streamerName;
    return this.entries.get(id)?.member.displayName
      ?? this.roundRoster.find(member => member.userId === id)?.displayName ?? id;
  }

  dethrone(by: string, victim: string): string | undefined {
    if (this.dethroned || victim !== this.crownUserId || by === victim
      || !this.roundRoster.some(member => member.userId === by)) return;
    this.dethroned = true;
    this.bonuses.set(by, (this.bonuses.get(by) ?? 0) + 3);
    return `@${this.name(by)} DETHRONED @${this.name(victim)}  +3`;
  }

  event(event: GameEvent): string[] {
    const announcements: string[] = [];
    if (event.t === 'finish' && !this.finished.includes(event.who)) this.finished.push(event.who);
    if (event.t === 'finish' && event.place === 1 && this.gameId === 'marble-race' && this.crownUserId
      && this.roundRoster.some(member => member.userId === this.crownUserId)) {
      const crown = this.dethrone(event.who, this.crownUserId);
      if (crown) announcements.push(crown);
    }
    if (event.t === 'territory' && this.crownUserId) {
      const crownMember = this.roundRoster.find(member => member.userId === this.crownUserId);
      if (crownMember?.teamId === event.from) {
        const crown = this.dethrone(event.by, this.crownUserId);
        if (crown) announcements.push(crown);
      }
    }
    if (event.t !== 'elim' || this.eliminated.includes(event.victim)) return announcements;
    this.eliminated.push(event.victim);
    if (!event.by || event.by === event.victim) return announcements;
    const key = `${event.by}:${event.victim}`;
    const count = (this.rivalries.get(key) ?? 0) + 1;
    this.rivalries.set(key, count);
    if (count >= 2) announcements.push(`@${this.name(event.by)} got @${this.name(event.victim)} AGAIN`);
    const crown = this.dethrone(event.by, event.victim);
    if (crown) announcements.push(crown);
    return announcements;
  }

  settle(gameId: string, round: number, result: RoundResult, game: GameInstance | undefined,
    faction: boolean, boss: boolean): CupRoundRecord {
    let order = placementOrder(this.roundRoster, result, game, this.eliminated, this.finished);
    const valid = result.winner.kind !== 'void';
    if (faction || boss) {
      const won = (id: string) => result.winner.kind === 'team'
        ? this.roundRoster.find(user => user.userId === id)?.teamId === result.winner.teamId
        : boss && result.winner.kind === 'chat';
      order = [...order.filter(won), ...order.filter(id => !won(id))];
    }
    if (valid && gameId === 'marble-race' && result.champion && this.crownUserId
      && this.roundRoster.some(member => member.userId === this.crownUserId)) {
      // The result is the physical finish, not a comparison of names or wagers.
      this.dethrone(result.champion.userId, this.crownUserId);
    }
    this.awards = order.map((id, index) => {
      const member = this.roundRoster.find(user => user.userId === id)!;
      const won = valid && (result.champion?.userId === id
        || result.winner.kind === 'team' && member.teamId === result.winner.teamId
        || boss && result.winner.kind === 'chat');
      const base = !valid ? 0 : faction || boss ? won ? 5 : 1
        : placementPoints(index + 1, this.roundRoster.length);
      const bonus = valid ? this.bonuses.get(id) ?? 0 : 0;
      const entry = this.entries.get(id)!;
      entry.points += base + bonus;
      entry.wins += Number(won);
      return { userId: id, login: member.login, displayName: member.displayName,
        points: base + bonus, place: index + 1, won,
        reason: !valid ? 'VOID' : `${faction || boss ? won ? 'WINNING SIDE' : 'PARTICIPATION' : `PLACE ${index + 1}`}${bonus ? ' + DETHRONE' : ''}` };
    });
    const winner = roundWinnerLabel(result);
    if (winner) this.lastWinners[gameId] = winner;
    if (round === 5 && valid) this.championId = result.champion?.userId;
    return { cupId: this.id, round, final: round === 5,
      awards: this.awards, championId: this.championId };
  }
}
