import { Graphics, type Text } from 'pixi.js';
import { TEAMS, type ChatGameInput, type GameEvent, type RoundResult, type StreamerInput, type Winner, type Participant, type Vec2 } from '@chaos/shared';
import { label } from '../engine/render';
import type { GameContext, GameInstance, GameStatus } from '../games/contract';
import { renderMarble, type Marble } from './marble';
import { Labels } from './labels';
import { Meter } from './meter';
export abstract class BaseGame implements GameInstance {
  time = 0; tick = 0; marbles: Marble[] = []; keys = new Set<string>(); events: GameEvent[] = [];
  result?: RoundResult; finale = false; protected finaleUntil = 0; protected started = false;
  protected graphics?: Graphics; protected labels: Labels; protected texts: Text[] = [];
  private textColors=new WeakMap<Text,number>();
  protected meters = new Map<string, Meter>(); protected cooldowns = new Map<string, number>();
  protected meterVerbs:readonly string[]=[];
  protected suppressInputFeed=false;
  protected lastWind = -1;
  protected aim?: Vec2;
  private contributions=new Map<string,number>();
  private pendingWinner?: Winner;
  private taps=new Set<string>();
  private finaleFocus:Vec2={x:960,y:520};
  constructor(readonly ctx: GameContext, readonly target: number) {
    this.labels = new Labels(ctx.headless ? undefined : ctx.stage.labels);
    if (!ctx.headless) { this.graphics = new Graphics(); ctx.stage.world.addChild(this.graphics); }
  }
  start(): void { if (this.started) return; this.started = true; if (this.ctx.setup.modifiers.includes('low-grav')) this.ctx.physics.world.gravity.y *= .45; }
  protected abstract update(dt: number): void;
  protected abstract draw(g: Graphics): void;
  protected abstract finish(): Winner;
  step(dt: number): void {
    if (!this.started || this.result) return;
    this.time += dt; this.tick++;
    if(this.meters.size)this.ctx.hud.setTeams([...this.meters].map(([team,meter])=>({team,value:meter.value(this.time,this.ctx.setup.mode==='cvs'?this.ctx.setup.participants.length:this.ctx.setup.participants.filter(p=>p.teamId===team).length)})));
    for (const m of this.marbles) { m.prevX = m.x; m.prevY = m.y; if (m.alive&&!m.dormant) m.body.resetForces(true); }
    if (!this.pendingWinner) this.update(dt);this.taps.clear();
    if (this.ctx.setup.modifiers.includes('wind')) {
      const segment = Math.floor(this.time / 6);
      if (segment !== this.lastWind) { this.lastWind = segment; const gust = this.ctx.rng.range(-2, 2); for (const m of this.alive()) m.body.applyImpulse({ x: gust, y: 0 }, true); this.ctx.hud.announce(gust > 0 ? 'STORM →' : '← STORM'); }
    }
    if (this.ctx.setup.modifiers.includes('magnet')) for (const m of this.alive()) m.body.addForce({ x: (960 - m.x) * .001, y: (520 - m.y) * .001 }, true);
    this.ctx.physics.step();
    for (const m of this.alive()) { const p = this.ctx.physics.position(m.body); m.x = p.x; m.y = p.y; if (!Number.isFinite(m.x + m.y)) throw new Error('Non-finite game position'); }
    if (this.pendingWinner && this.time >= this.finaleUntil) { const winner = this.pendingWinner; this.pendingWinner = undefined; this.complete(winner); }
    if (this.time >= this.target && !this.result && !this.pendingWinner) this.complete(this.finish());
  }
  protected roster(perTeam = 6): Participant[] {
    if (this.ctx.setup.mode !== 'faction') return this.ctx.setup.participants;
    const teams = this.ctx.setup.teams ?? ['red', 'blue']; const result: Participant[] = [];
    for (const teamId of teams) {
      const members = this.ctx.setup.participants.filter(p => p.teamId === teamId);
      for (let i = 0; i < perTeam; i++) { const p = members[i % Math.max(1, members.length)]; result.push({ ...(p ?? { userId: `${teamId}-${i}`, login: teamId, displayName: `${TEAMS[teamId].name} #${i + 1}`, color: TEAMS[teamId].color }), userId: p ? `${p.userId}~${i}` : `${teamId}-${i}`, teamId }); }
    }
    return this.ctx.rng.shuffle(result);
  }
  protected spawn(owner: Participant, x: number, y: number, radius = 16, streamer = false): Marble { const m = this.ctx.kit.marble(this.ctx, owner, x, y, { radius, streamer }); m.born = this.started?this.time:-.25; this.marbles.push(m); return m; }
  protected hero(x: number, y: number, radius = 28): Marble { return this.spawn({ userId: 'streamer', login: 'streamer', displayName: this.ctx.setup.streamerName, color: '#ff5d9e' }, x, y, radius, true); }
  protected setTeam(m:Marble,team:string):void{m.team=team;m.color=team==='streamer'?0xff5d9e:team==='chat'?0x4db4ff:TEAMS[team as keyof typeof TEAMS]?.hex??m.color;if(this.ctx.setup.mode==='faction'&&team in TEAMS)m.owner={...m.owner,teamId:team as keyof typeof TEAMS,color:TEAMS[team as keyof typeof TEAMS].color};}
  protected alive(team?: string): Marble[] { return this.marbles.filter(m => m.alive && !m.dormant && (!team || m.team === team)); }
  protected emit(e: GameEvent): void { if (this.events.length < 1000) this.events.push(e); this.ctx.emit(e); }
  protected big(text: string, x = 960, y = 500, color = 0xffd23f): void {
    this.emit({ t: 'moment', text, intensity: 3 }); this.ctx.camera.shake(.45); this.ctx.camera.punch(); this.ctx.fx.hitStop(70); this.ctx.fx.burst(x, y, color, 35); this.ctx.fx.ring(x, y, color); this.ctx.audio.play('explosion');
  }
  protected eliminate(m: Marble, cause: string, by?: string): void {
    if (!m.alive) return;
    if (m.shield > this.time) { m.shield = 0; this.ctx.fx.text(m.x, m.y, 'BLOCKED!', 0xb5eeff); this.ctx.audio.play('chime'); return; }
    m.alive = false; this.ctx.physics.remove(m.body); if (m.view) m.view.visible = false;this.ctx.fx.death(m.x,m.y,m.color);
    this.emit({ t: 'elim', victim: m.owner.displayName, cause, by }); this.ctx.fx.burst(m.x, m.y, m.color, 18); this.ctx.fx.text(m.x, m.y - 20, `${m.owner.displayName}: ${cause}`, m.color); this.ctx.audio.play('pop');
  }
  protected score(m: Marble, amount: number, text = `+${amount}`): void { m.score += amount; this.ctx.fx.text(m.x, m.y - 20, text, m.color); this.ctx.fx.burst(m.x, m.y, m.color, 8); this.ctx.audio.play('coin', Math.max(0, Math.floor(m.score) % 10)); this.emit({ t: 'finish', who: m.owner.displayName, place: Math.max(1, Math.round(amount)) }); }
  protected ready(action: string, cooldown: number): boolean { if (this.time < (this.cooldowns.get(action) ?? -1)) return false; this.cooldowns.set(action, this.time + cooldown); return true; }
  /** Action presses survive a down/up pair between two fixed simulation ticks. */
  protected pressed(action:string):boolean{return this.keys.has(action)||this.taps.has(action);}
  controlHints():Record<string,number>{return Object.fromEntries([...this.cooldowns].map(([action,until])=>[action,Math.max(0,until-this.time)]));}
  onJoin(_participant:Participant):boolean{return false;}
  chatHints(userId:string):Record<string,number>{const team=this.ctx.setup.mode==='cvs'?'chat':this.ctx.setup.participants.find(p=>p.userId===userId)?.teamId??'red',eligible=this.ctx.setup.mode==='cvs'?this.ctx.setup.participants.length:this.ctx.setup.participants.filter(p=>p.teamId===team).length;return Object.fromEntries((this.meterVerbs??[]).map(verb=>[verb,this.meters.get(team)?.value(this.time,eligible)??0]));}
  protected telegraph(seconds:number):number{return seconds*(this.ctx.setup.modifiers.includes('turbo')?1.35:1);}
  protected close(reason: string, x = 960, y = 500): void { if (this.finale) return; this.finale = true;this.finaleFocus={x,y}; this.finaleUntil = this.time + .8; this.emit({ t: 'finale', focus: { x, y } }); this.ctx.audio.play('heartbeat'); }
  protected best(scores: Map<string, number>): Winner { const highest = Math.max(...scores.values()); const tied = [...scores].filter(([, v]) => v === highest); const key = this.ctx.rng.pick(tied)[0]; return this.winner(key); }
  protected winner(team: string): Winner { return team === 'streamer' ? { kind: 'streamer' } : team === 'chat' ? { kind: 'chat' } : { kind: 'team', teamId: team as keyof typeof TEAMS }; }
  protected teamScores(kind: 'score' | 'alive' = 'score'): Map<string, number> { const map = new Map<string, number>(); for (const m of this.marbles) map.set(m.team, (map.get(m.team) ?? 0) + (kind === 'alive' ? Number(m.alive&&!m.dormant) : m.score)); return map; }
  protected complete(winner: Winner): void {
    if (this.result) return;
    if (this.finale && this.time < this.finaleUntil) { this.pendingWinner = winner; return; }
    const perUser: RoundResult['perUser'] = Object.create(null);
    for (const p of this.ctx.setup.participants) perUser[p.userId] = { score: 0, tags: [...(p.teamId ? [`team:${p.teamId}`] : []), ...(winner.kind === 'chat' || winner.kind === 'team' && winner.teamId === p.teamId ? ['win'] : [])] };
    for (const m of this.marbles.filter(m => !m.isStreamer&&m.team!=='streamer')) {
      const id = m.id.split('~')[0]; const wins = winner.kind === 'chat' || winner.kind === 'team' && winner.teamId === m.team;
      if(!perUser[id]){const members=this.ctx.setup.participants.filter(p=>this.ctx.setup.mode==='cvs'||p.teamId===m.team);for(const p of members)perUser[p.userId].score+=m.score/Math.max(1,members.length);continue;}
      const entry = perUser[id] ??= { score: 0, tags: [] }; entry.score += m.score;
      for (const tag of [...(wins ? ['win'] : []), ...(m.alive&&!m.dormant ? ['survived'] : []), ...(m.owner.teamId ? [`team:${m.owner.teamId}`] : [])]) if (!entry.tags.includes(tag)) entry.tags.push(tag);
    }
    for (const e of this.events) if (e.t === 'hit' && e.target === 'streamer' && e.by && perUser[e.by]) { perUser[e.by].score += e.dmg ?? 1; if (!perUser[e.by].tags.includes('crushed_streamer')) perUser[e.by].tags.push('crushed_streamer'); }
    for(const[id,n]of this.contributions)if(perUser[id])perUser[id].score+=n;
    const top = Object.entries(perUser).sort((a, b) => b[1].score - a[1].score).slice(0, 3);
    this.result = { winner, mvps: top.map(([userId, r], i) => ({ userId, title: ['FACTORY MVP', 'CHAOS AGENT', 'CROWD FAVORITE'][i], stat: `${Math.round(r.score)} POINTS` })), highlights: this.events, perUser, replay: { seed: this.ctx.setup.seed, inputs: [] } };
  }
  onChat(input: ChatGameInput): void {
    this.contributions.set(input.userId,(this.contributions.get(input.userId)??0)+1);
    if(!this.suppressInputFeed)this.ctx.hud.feedback?.(input.userId,input.verb,input.teamId);
    if(this.meterVerbs.includes(input.verb)){const team = this.ctx.setup.mode==='faction'?input.teamId??'red':'chat'; const meter = this.meters.get(team) ?? new Meter(); this.meters.set(team, meter); meter.add(input.userId, this.time);}
    this.chat(input);
  }
  protected chat(_input: ChatGameInput): void {}
  onStreamer(input: StreamerInput): void { if(input.action==='aimX'&&input.value!==undefined)this.aim={x:input.value,y:this.aim?.y??520};else if(input.action==='aimY'&&input.value!==undefined)this.aim={x:this.aim?.x??960,y:input.value};else if(input.action==='left'||input.action==='right')this.aim=undefined;if (input.pressed){if(!this.keys.has(input.action))this.taps.add(input.action);this.keys.add(input.action);}else this.keys.delete(input.action); this.control(input); }
  protected control(_input: StreamerInput): void {}
  protected meter(team: string): boolean { const eligible = this.ctx.setup.mode==='cvs'?this.ctx.setup.participants.length:this.ctx.setup.participants.filter(p => p.teamId === team).length; return this.meters.get(team)?.consume(this.time, eligible) ?? false; }
  protected text(text: string, x: number, y: number, size = 32, color = 0xffffff, index = 0): void {
    if (this.ctx.headless) return; const v = this.texts[index] ??= this.ctx.stage.hudWorld.addChild(label('', size, color, size >= 48));if(v.text!==text)v.text = text;if(this.textColors.get(v)!==color){v.style.fill = color;this.textColors.set(v,color);}v.position.set(x, y); v.visible = true;
  }
  inspect(){return{time:this.time,keys:[...this.keys],marbles:this.marbles.map(m=>({id:m.id,name:m.owner.displayName,team:m.team,x:m.x,y:m.y,radius:m.radius,alive:m.alive,dormant:Boolean(m.dormant),isStreamer:m.isStreamer,boost:m.boost,heat:m.heat,staged:Boolean(m.staged),finished:m.finished})),details:this.debugInfo()};}
  protected debugInfo():Record<string,unknown>{return{};}
  render(alpha: number): void { if (this.graphics) { this.graphics.clear(); this.draw(this.graphics); } for (const m of this.marbles) {if(!m.alive){m.view?.destroy({children:true,context:true});m.view=undefined;}else renderMarble(m, this.ctx, this.time, alpha,!this.started);} this.labels.render(this.marbles,!this.started); }
  status(): GameStatus { if (this.result) return { done: this.result }; if (this.finale && this.time < this.finaleUntil) return { finale: { focus:this.finaleFocus, reason: 'Close finish' } }; return 'playing'; }
  destroy(): void { for (const m of this.marbles) { if (m.body.isValid()) this.ctx.physics.remove(m.body); m.view?.destroy({children:true,context:true}); } this.marbles = []; this.graphics?.destroy(); this.labels.destroy(); for (const t of this.texts) t?.destroy();this.texts=[]; }
}
