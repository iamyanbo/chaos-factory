import { Rng, TEAMS, TEAM_IDS, createPredictionSchema, parseChat, type ChatMessage, type Prediction, type DirectorState } from '@chaos/shared';
import { BridgeError, type TwitchBridge } from './bridge';
interface Bot { id: string; login: string; team: typeof TEAM_IDS[number]; personality: string; balance: number; nextAt: number }
interface Bet { userId: string; login: string; outcome: number; points: number }
export class MockBridge implements TwitchBridge {
  onChat: (c: ChatMessage) => void = () => {};
  onPrediction: (p: Prediction) => void = () => {};
  rng = new Rng(19451); bots: Bot[] = []; prediction?: Prediction;
  bets: Bet[] = []; connected = false; activity = 0.45; delay: [number, number];
  personalities: Record<string, number> = { spammer: .15, voter: .25, loyal: .35, lurker: .15, traitor: .1 };
  private queue: { at: number; login: string; text: string }[] = [];
  private timer?: ReturnType<typeof setInterval>; private count = 0;
  constructor(viewers: number, delay: [number, number], private clock: () => number = Date.now) { this.delay = delay; this.configure(viewers, .45, delay); }
  configure(viewers: number, activity: number, delay: [number, number], personalities?: Record<string, number>): void {
    this.activity = activity; this.delay = [Math.min(...delay), Math.max(...delay)];
    if (personalities && Object.values(personalities).some(v => v > 0)) {this.personalities = personalities;for(const bot of this.bots)bot.personality=this.rng.weighted(Object.entries(personalities).map(([value,weight])=>({value,weight})));}
    while (this.bots.length < viewers) {
      const i = this.bots.length;
      const words = ['neon', 'cosmic', 'tiny', 'sleepy', 'spicy', 'lucky', 'minty', 'chaos', 'pixel', 'moon'];
      const animals = ['otter', 'moth', 'fox', 'bean', 'frog', 'panda', 'ghost', 'duck'];
      const login = `${words[i % words.length]}_${animals[Math.floor(i / words.length) % animals.length]}${i >= 80 ? i : ''}`;
      const u = Math.max(.0001, this.rng.next()); const v = this.rng.next();
      const logNormal = Math.exp(7.2 + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
      this.bots.push({ id: login, login, team: TEAM_IDS[i % 4], personality: this.rng.weighted(Object.entries(this.personalities).map(([value, weight]) => ({ value, weight }))), balance: Math.max(100, Math.floor(logNormal)), nextAt: this.clock() + this.rng.int(0, 4000) });
    }
    this.bots.length = viewers;
    const present = new Set(this.bots.map(bot => bot.login));
    this.queue = this.queue.filter(message => present.has(message.login));
  }
  async connect(): Promise<void> { this.connected = true; this.timer = setInterval(() => this.tick(), 100); }
  disconnect(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; this.connected = false; }
  state(state: DirectorState): void {
    if (state.teams) this.bots.forEach((bot, index) => {
      bot.team = state.teams![index % state.teams!.length];
    });
  }
  manual(login: string, text: string): void {
    if (!parseChat(text)) return;
    const bot = this.bots.find(b => b.login === login);
    this.onChat({ type: 'chat', userId: login, login, displayName: login, color: bot ? TEAMS[bot.team].color : '#a98bff', text: text.slice(0, 500), isMod: false, isBroadcaster: false, receivedAt: this.clock() });
  }
  tick(): void {
    const now = this.clock();
    const due = this.queue.filter(x => x.at <= now); this.queue = this.queue.filter(x => x.at > now);
    for (const m of due) this.manual(m.login, m.text);
    if (this.prediction?.status === 'ACTIVE' && now >= (this.prediction.locksAt ?? Infinity)) void this.lockPrediction();
    for (const bot of this.bots) {
      if (now < bot.nextAt) continue;
      const factor = bot.personality === 'lurker' ? 6 : bot.personality === 'spammer' ? .5 : 1;
      bot.nextAt = now + this.rng.range(2400, 6500) * factor / Math.max(.05, this.activity);
      const text = `!join ${bot.team}`;
      this.queue.push({ at: now + this.rng.range(...this.delay), login: bot.login, text });
      if (this.prediction?.status === 'ACTIVE' && !this.bets.some(b => b.userId === bot.id)) this.bet(bot);
    }
  }
  private bet(bot: Bot): void {
    if(bot.balance<1)return;
    const p = this.prediction!;
    let index = p.outcomes.findIndex(o => o.title === TEAMS[bot.team].name);
    if (bot.personality === 'traitor' && index >= 0) index = (index + 1) % p.outcomes.length;
    if (index < 0) index = this.rng.int(0, p.outcomes.length - 1);
    const points = Math.max(1, Math.floor(bot.balance * this.rng.range(.05, .5)));
    bot.balance -= points; this.bets.push({ userId: bot.id, login: bot.login, outcome: index, points });
    const o = p.outcomes[index]; o.points += points; o.users++;
    o.top = this.bets.filter(b => b.outcome === index).sort((a, b) => b.points - a.points).slice(0, 10).map(b => ({ userId: b.userId, login: b.login, points: b.points }));
    this.emit();
  }
  private emit(): void { if (this.prediction) this.onPrediction(structuredClone(this.prediction)); }
  async createPrediction(title: string, outcomes: string[], windowSec: number): Promise<Prediction> {
    if (!createPredictionSchema.safeParse({ title, outcomes, windowSec }).success) throw new BridgeError('INVALID_ARGUMENT', 'Invalid prediction title, outcomes or window');
    if (this.prediction && ['ACTIVE', 'LOCKED'].includes(this.prediction.status)) throw new BridgeError('ALREADY_ACTIVE', 'Only one prediction at a time');
    this.bets = [];
    this.prediction = { id: `mock-${++this.count}`, status: 'ACTIVE', locksAt: this.clock() + windowSec * 1000, outcomes: outcomes.map((title, i) => ({ id: `outcome-${i}`, title, users: 0, points: 0, top: [] })) };
    this.emit(); return structuredClone(this.prediction);
  }
  async lockPrediction(): Promise<void> {
    if (!this.prediction) throw new BridgeError('NOT_FOUND', 'No prediction');
    if (this.prediction.status === 'LOCKED') return;
    if (this.prediction.status !== 'ACTIVE') throw new BridgeError('INVALID_STATE', 'Prediction already ended');
    this.prediction.status = 'LOCKED'; this.emit();
  }
  async resolvePrediction(outcomeIndex: number): Promise<void> {
    const p = this.prediction;
    if (!p || !['ACTIVE', 'LOCKED'].includes(p.status)) throw new BridgeError('INVALID_STATE', 'No open prediction');
    if (!p.outcomes[outcomeIndex]) throw new BridgeError('INVALID_ARGUMENT', 'Unknown outcome');
    const pool = p.outcomes.reduce((s, o) => s + o.points, 0);
    const winning = this.bets.filter(b => b.outcome === outcomeIndex);
    if (!winning.length) { await this.cancelPrediction('No winning bettors; mock refunds'); return; }
    let remaining = pool; const total = p.outcomes[outcomeIndex].points; const payouts: Record<string, number> = Object.create(null);
    winning.forEach((b, i) => { const n = i === winning.length - 1 ? remaining : Math.floor(pool * b.points / total); remaining -= n; payouts[b.userId] = n; const bot = this.bots.find(x => x.id === b.userId); if (bot) bot.balance += n; });
    p.payouts = payouts; p.winnerIndex = outcomeIndex; p.status = 'RESOLVED'; this.emit();
  }
  async cancelPrediction(_reason: string): Promise<void> {
    if (!this.prediction || !['ACTIVE', 'LOCKED'].includes(this.prediction.status)) return;
    const refunds: Record<string, number> = Object.create(null);
    for (const bet of this.bets) { refunds[bet.userId] = bet.points; const bot = this.bots.find(b => b.id === bet.userId); if (bot) bot.balance += bet.points; }
    this.prediction.status = 'CANCELED'; this.prediction.payouts = refunds; this.emit();
  }
  async say(_text: string): Promise<void> { /* Mock has no external chat transport. */ }
  status() { return { mode: 'mock' as const, connected: this.connected, channel: 'chaos_factory_mock', canPredict: true }; }
  snapshot() { return {prediction:this.prediction,bets:this.bets,balances:this.bots.map(b=>({id:b.id,balance:b.balance})),count:this.count}; }
  restore(data:ReturnType<MockBridge['snapshot']>):void{this.prediction=data.prediction;this.bets=data.bets??[];this.count=data.count??0;for(const row of data.balances??[]){const bot=this.bots.find(b=>b.id===row.id);if(bot&&Number.isFinite(row.balance))bot.balance=row.balance;}}
}
