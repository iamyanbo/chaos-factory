import { Rng, TEAMS, TEAM_IDS, parseChat, type ChatMessage, type DirectorState } from '@chaos/shared';
import type { TwitchBridge } from './bridge';

interface Bot {
  login: string;
  team: typeof TEAM_IDS[number];
  nextAt: number;
}

/** Offline joins use the same chat path, with a simulated stream delay. */
export class MockBridge implements TwitchBridge {
  onChat: (chat: ChatMessage) => void = () => {};
  readonly rng = new Rng(19451);
  bots: Bot[] = [];
  connected = false;
  activity = .45;
  delay: [number, number];
  personalities: Record<string, number> = {};
  private queue: { at: number; login: string; text: string }[] = [];
  private timer?: ReturnType<typeof setInterval>;

  constructor(viewers: number, delay: [number, number], private clock: () => number = Date.now) {
    this.delay = delay;
    this.configure(viewers, this.activity, delay);
  }

  configure(viewers: number, activity: number, delay: [number, number]): void {
    this.activity = activity;
    this.delay = [Math.min(...delay), Math.max(...delay)];
    const words = ['neon', 'cosmic', 'tiny', 'sleepy', 'spicy', 'lucky', 'minty', 'chaos', 'pixel', 'moon'];
    const animals = ['otter', 'moth', 'fox', 'bean', 'frog', 'panda', 'ghost', 'duck'];
    while (this.bots.length < viewers) {
      const index = this.bots.length;
      const login = `${words[index % words.length]}_${animals[Math.floor(index / words.length) % animals.length]}${index >= 80 ? index : ''}`;
      this.bots.push({ login, team: TEAM_IDS[index % 4], nextAt: this.clock() + this.rng.int(0, 4000) });
    }
    this.bots.length = viewers;
    const present = new Set(this.bots.map(bot => bot.login));
    this.queue = this.queue.filter(message => present.has(message.login));
  }

  async connect(): Promise<void> {
    if (this.timer) return;
    this.connected = true;
    this.timer = setInterval(() => this.tick(), 100);
  }

  disconnect(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.connected = false;
  }

  state(state: DirectorState): void {
    if (state.teams) this.bots.forEach((bot, index) => {
      bot.team = state.teams![index % state.teams!.length];
    });
  }

  manual(login: string, text: string): void {
    if (!parseChat(text)) return;
    const bot = this.bots.find(bot => bot.login === login);
    this.onChat({ type: 'chat', userId: login, login, displayName: login,
      color: bot ? TEAMS[bot.team].color : '#a98bff', text: text.slice(0, 500),
      isMod: false, isBroadcaster: false, receivedAt: this.clock() });
  }

  tick(): void {
    const now = this.clock();
    const due = this.queue.filter(message => message.at <= now);
    this.queue = this.queue.filter(message => message.at > now);
    for (const message of due) this.manual(message.login, message.text);
    for (const bot of this.bots) {
      if (now < bot.nextAt) continue;
      bot.nextAt = now + this.rng.range(2400, 6500) / Math.max(.05, this.activity);
      this.queue.push({ at: now + this.rng.range(...this.delay), login: bot.login, text: '!join' });
    }
  }

  status() {
    return { mode: 'mock' as const, connected: this.connected, channel: 'chaos_factory_mock' };
  }
}
