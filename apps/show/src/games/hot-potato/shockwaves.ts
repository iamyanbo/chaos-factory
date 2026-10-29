import type { GameContext } from '../contract';
import { PX } from '../../engine/physics';
import { BLAST_FADE_SECONDS, BLAST_FALLOFF, BLAST_IMPULSE_SPEED, BLAST_RADIUS, BLAST_SPEED,
  BOMB_COLOR, GOLDEN_ANGLE, MEGA_COLOR, MEGA_RADIUS } from './config';
import type { PotatoArena } from './arena';
import type { Bomb, Potato, RimSegment, Shockwave } from './types';

/** The visible expanding front is the sole source of blast impulses and rim damage. */
export class Shockwaves {
  active: Shockwave[] = [];

  constructor(private ctx: GameContext, private arena: PotatoArena,
    private marbles: Potato[], private broken: (segments: RimSegment[]) => void) {}

  add(bomb: Bomb, holder: Potato, time: number): Shockwave {
    const wave: Shockwave = { id: bomb.id, x: holder.x, y: holder.y, at: time,
      radius: 0, previousRadius: 0, range: bomb.mega ? MEGA_RADIUS : BLAST_RADIUS,
      color: bomb.mega ? MEGA_COLOR : BOMB_COLOR, mega: bomb.mega,
      attacker: bomb.passer, kills: 0, hit: new Set() };
    this.active.push(wave);
    return wave;
  }

  step(time: number): void {
    for (const wave of this.active) {
      wave.previousRadius = wave.radius;
      wave.radius = Math.min(wave.range, Math.max(0, time - wave.at) * BLAST_SPEED);
      if (wave.radius <= wave.previousRadius) continue;
      this.broken(this.arena.breakReached(wave.x, wave.y, wave.radius));
      for (const marble of this.marbles) {
        if (!marble.alive || wave.hit.has(marble.ordinal)) continue;
        const dx = marble.x - wave.x;
        const dy = marble.y - wave.y;
        const distance = Math.hypot(dx, dy);
        if (distance - marble.radius > wave.radius
          || distance + marble.radius < wave.previousRadius) continue;
        wave.hit.add(marble.ordinal);
        const direction = distance > .001 ? { x: dx / distance, y: dy / distance }
          : { x: Math.cos(marble.ordinal * GOLDEN_ANGLE), y: Math.sin(marble.ordinal * GOLDEN_ANGLE) };
        const deltaSpeed = BLAST_IMPULSE_SPEED * (1 - BLAST_FALLOFF * Math.min(1, distance / wave.range));
        const impulse = marble.body.mass() * deltaSpeed / PX;
        marble.body.applyImpulse({ x: direction.x * impulse, y: direction.y * impulse }, true);
        marble.blast = wave;
        marble.blastAt = time;
      }
    }
    this.active = this.active.filter(wave => time - wave.at
      < wave.range / BLAST_SPEED + BLAST_FADE_SECONDS);
  }
}
