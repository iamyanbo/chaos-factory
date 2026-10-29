import { newViewerProfile, profileLevel, profileTitle, roundWinnerLabel, viewerProfileSchema,
  type CupRoundRecord, type Message, type Participant, type RoundResult, type ViewerProfile } from '@chaos/shared';
import type { JsonStore } from './storage';

interface ProfileData {
  users: Record<string, ViewerProfile>;
  crownUserId?: string;
  lastWinners: Record<string, string>;
  processed: string[];
}

export class Profiles {
  private data: ProfileData = { users: Object.create(null), processed: [], lastWinners: {} };
  constructor(private store: JsonStore) {}

  async load(): Promise<void> {
    this.data = await this.store.read('profiles.json', this.data);
    const users: Record<string, ViewerProfile> = Object.create(null);
    for (const [id, saved] of Object.entries(this.data.users)) {
      const profile = viewerProfileSchema.safeParse(saved);
      if (profile.success) users[id] = profile.data;
    }
    this.data.users = users;
    this.data.lastWinners ??= {};
  }

  ensure(user: Pick<Participant, 'userId' | 'login' | 'displayName'>): ViewerProfile {
    const profile = this.data.users[user.userId] ??= newViewerProfile(user);
    profile.login = user.login;
    profile.displayName = user.displayName;
    return profile;
  }

  async record(gameId: string, roundId: string, cup: CupRoundRecord, result?: RoundResult): Promise<void> {
    if (this.data.processed.includes(roundId)) return;
    for (const award of cup.awards) {
      const profile = this.ensure(award);
      profile.xp += award.points;
      profile.wins += Number(award.won);
      if (award.won) profile.gameWins[gameId] = (profile.gameWins[gameId] ?? 0) + 1;
      if (cup.final && cup.championId === award.userId) profile.cupsWon++;
      profile.level = profileLevel(profile.xp);
      profile.title = profileTitle(profile);
    }
    if (cup.final && cup.championId) this.data.crownUserId = cup.championId;
    const winner = result ? roundWinnerLabel(result) : cup.awards.find(award => award.won)?.displayName;
    if (winner) this.data.lastWinners[gameId] = winner;
    this.data.processed.push(roundId);
    this.data.processed = this.data.processed.slice(-5000);
    await this.save();
  }

  save(): Promise<void> { return this.store.write('profiles.json', this.data); }

  snapshot(): Extract<Message, { type: 'profiles.snapshot' }> {
    const users = Object.values(this.data.users).sort((a, b) => b.xp - a.xp).slice(0, 500);
    const crown = this.data.crownUserId && this.data.users[this.data.crownUserId];
    if (crown && !users.includes(crown)) users.push(crown);
    return { type: 'profiles.snapshot', users: Object.fromEntries(users.map(user => [user.userId, user])),
      crownUserId: this.data.crownUserId, lastWinners: this.data.lastWinners };
  }
}
