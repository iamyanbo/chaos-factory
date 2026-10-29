import type { GameContext } from '../contract';
import { BLUE_POINTS, FEVER_MULTIPLIER, GOLD_MULTIPLIER, ORANGE_POINTS, SLOTS } from './config';
import type { PegBoard } from './board';
import type { Landing, Peg, Shot } from './types';

export class PegScoring {
  readonly scores: number[];
  readonly hits: number[];
  readonly oranges: number[];
  readonly landed: number[];
  readonly landings: Landing[] = [];
  remaining = 20;

  constructor(readonly ctx: GameContext, readonly board: PegBoard,
    private fever: (shot: Shot, peg: Peg) => void) {
    this.scores = ctx.setup.participants.map(() => 0);
    this.hits = [...this.scores];
    this.oranges = [...this.scores];
    this.landed = [...this.scores];
  }

  hit(shot: Shot, peg: Peg, time: number): boolean {
    if (!shot.active || peg.removed || peg.claim !== undefined) return false;
    peg.claim = shot.life;
    peg.litAt = time;
    shot.combo++;
    this.hits[shot.owner]++;
    const before = shot.points;
    if (peg.kind === 'gold') {
      shot.multiplier = GOLD_MULTIPLIER;
      shot.points *= GOLD_MULTIPLIER;

    } else {
      const base = peg.kind === 'orange' ? ORANGE_POINTS : BLUE_POINTS;
      shot.points += base * shot.combo * shot.multiplier;
    }

    this.ctx.emit({ t: 'hit', target: `peg-${peg.id}`, by: shot.player.userId, dmg: shot.points - before });
    this.ctx.emit({ t: 'activity', time, kind: 'hit' });
    if (peg.kind === 'orange') {
      this.oranges[shot.owner]++;
      if (--this.remaining === 0) this.fever(shot, peg);
    }
    return true;
  }

  settle(shot: Shot, slot: number, fever: boolean, time: number): Landing | undefined {
    if (!shot.active || shot.landed) return undefined;
    shot.landed = true;
    const multiplier = SLOTS[slot].multiplier * (fever ? FEVER_MULTIPLIER : 1);
    const total = shot.points * multiplier;
    this.scores[shot.owner] += total;
    this.landed[shot.owner]++;
    const landing = { life: shot.life, owner: shot.owner, run: shot.points, slot,
      multiplier, total, ownerTotal: this.scores[shot.owner], x: shot.x, time };
    this.landings.push(landing);
    return landing;
  }
}
