import type { GameContext } from '../contract';
import { BEEP_MAX_INTERVAL, BEEP_MIN_INTERVAL, BEEP_NOTES, BEEP_SPEED,
  BOMB_COLOR, BREATHER_SECONDS, CLUTCH_SECONDS, DECISIVE_SECONDS,
  FUSE_MAX, FUSE_MIN, MEGA_CHANCE, MEGA_COLOR, MEGA_LAST_BOMB, SHORT_FUSE_BELOW, SHORT_FUSE_FACTOR,
  TRANSFER_COOLDOWN, TWO_BOMBS_BELOW } from './config';
import { leadingPotato } from './actors';
import type { Bomb, Potato } from './types';

export class BombRack {
  active: Bomb[] = [];
  readonly pending: number[] = [];
  private nextId = 0;
  private readonly megaId: number;

  constructor(private ctx: GameContext, private marbles: Potato[]) {
    this.megaId = ctx.rng.chance(MEGA_CHANCE) ? ctx.rng.int(0, MEGA_LAST_BOMB) : -1;
  }

  refill(time: number, initial = false): void {
    const living = this.marbles.filter(marble => marble.alive);
    if (living.length < 2) return;
    if (living.length < SHORT_FUSE_BELOW) {
      for (const bomb of this.active) {
        if (bomb.shortened) continue;
        bomb.duration *= SHORT_FUSE_FACTOR;
        bomb.remaining *= SHORT_FUSE_FACTOR;
        bomb.shortened = true;
        bomb.beepAt = Math.min(time, bomb.beepAt);
      }
    }
    const desired = living.length < TWO_BOMBS_BELOW ? 2 : 1;
    while (this.active.length + this.pending.length < desired) {
      this.pending.push(time + (initial ? 0 : BREATHER_SECONDS));
    }
    for (let index = this.pending.length - 1; index >= 0; index--) {
      if (time + 1e-8 < this.pending[index]) continue;
      const candidates = living.filter(marble => !this.active.some(bomb => bomb.holder === marble.ordinal));
      if (!candidates.length) continue;
      const holder = this.ctx.rng.pick(candidates);
      const duration = this.ctx.rng.range(FUSE_MIN, FUSE_MAX)
        * (living.length < SHORT_FUSE_BELOW ? SHORT_FUSE_FACTOR : 1);
      const id = this.nextId++;
      this.active.push({ id, holder: holder.ordinal, remaining: duration,
        duration, transferAt: time, beepAt: time, mega: id === this.megaId,
        shortened: living.length < SHORT_FUSE_BELOW });
      this.pending.splice(index, 1);
      this.ctx.emit({ t: 'activity', time, kind: 'birth' });
    }
  }

  transfer(a: Potato, b: Potato, time: number): boolean {
    if (!a.alive || !b.alive) return false;
    const fromA = this.active.find(bomb => bomb.holder === a.ordinal);
    const fromB = this.active.find(bomb => bomb.holder === b.ordinal);
    if (Boolean(fromA) === Boolean(fromB)) return false;
    const bomb = (fromA ?? fromB)!;
    if (time + 1e-8 < bomb.transferAt || bomb.remaining <= 0) return false;
    const passer = fromA ? a : b;
    const receiver = fromA ? b : a;
    bomb.holder = receiver.ordinal;
    bomb.passer = passer.ordinal;
    bomb.transferAt = time + TRANSFER_COOLDOWN;
    passer.tags++;
    const subject = { userId: passer.id, name: passer.name, color: passer.color,
      key: `tagger:${passer.ordinal}` };
    this.ctx.emit({ t: 'activity', time, kind: 'hit' });

    if (bomb.remaining <= CLUTCH_SECONDS) {
      if (passer.id === this.ctx.setup.crownUserId || leadingPotato(this.marbles) === passer) {
        this.ctx.hype.nearMiss(passer.x, passer.y, subject);
      }
      if (bomb.remaining < DECISIVE_SECONDS) this.ctx.hype.decisive(passer.x, passer.y, subject);
    }
    if (!this.ctx.headless) this.ctx.audio.play('clack', bomb.mega ? 4 : 2);
    return true;
  }

  burn(dt: number, time: number, rate: number): Bomb[] {
    const expired: Bomb[] = [];
    for (const bomb of this.active) {
      bomb.remaining -= dt * rate;
      if (time >= bomb.beepAt && bomb.remaining > 0) {
        const fraction = Math.max(0, bomb.remaining / bomb.duration);
        bomb.beepAt = time + Math.max(BEEP_MIN_INTERVAL, fraction * BEEP_MAX_INTERVAL) / rate;
        if (!this.ctx.headless) this.ctx.audio.bounce(Math.floor((1 - fraction) * BEEP_NOTES), BEEP_SPEED, 1);
      }
      if (bomb.remaining <= 1e-8) expired.push(bomb);
    }
    const ids = new Set(expired.map(bomb => bomb.id));
    this.active = this.active.filter(bomb => !ids.has(bomb.id));
    for (const bomb of expired) this.pending.push(time + BREATHER_SECONDS);
    return expired;
  }

  removeDead(time: number): void {
    const lost = this.active.filter(bomb => !this.marbles[bomb.holder].alive);
    this.active = this.active.filter(bomb => this.marbles[bomb.holder].alive);
    for (const bomb of lost) this.pending.push(time + BREATHER_SECONDS);
  }
}

export const bombSubject = (marble: Potato, bomb: Bomb) => ({ userId: marble.id,
  name: marble.name, color: bomb.mega ? MEGA_COLOR : BOMB_COLOR, key: `blast:${bomb.id}` });
