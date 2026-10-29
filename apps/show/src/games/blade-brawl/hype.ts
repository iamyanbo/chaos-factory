import type { GameContext } from '../contract';
import { type HypeSubject } from '../../kit/hype';
import { pointSegmentDistanceSquared, pose } from './weapons';
import type { Fighter, Weapon, WeaponPose } from './types';
import { damageMultiplier } from './rage';

const NEAR_MISS_RADII = 0.3;
const BLADE_HALF_WIDTH = 3;
const MIN_VISIBLE_LENGTH = 2;
const HAMMER_HALF_LENGTH = 10;
const HAMMER_HALF_WIDTH = 17;

function subject(fighter: Fighter): HypeSubject {
  return { userId: fighter.id, name: fighter.name, color: fighter.color, key: fighter.id };
}

/** Signed gap from the drawn damaging shape to the target's circle. */
function gap(blade: WeaponPose, target: Fighter, previous = false): number {
  if (Math.hypot(blade.bx - blade.ax, blade.by - blade.ay) < MIN_VISIBLE_LENGTH) return Infinity;
  const x = previous ? target.prevX : target.x;
  const y = previous ? target.prevY : target.y;
  if (blade.weapon.kind !== 'Hammer') {
    return Math.sqrt(pointSegmentDistanceSquared(x, y, blade)) - target.radius - BLADE_HALF_WIDTH;
  }
  if (!blade.head) return Infinity;
  const dx = x - blade.bx;
  const dy = y - blade.by;
  const along = Math.cos(blade.angle) * dx + Math.sin(blade.angle) * dy;
  const across = -Math.sin(blade.angle) * dx + Math.cos(blade.angle) * dy;
  return Math.hypot(Math.max(0, Math.abs(along) - HAMMER_HALF_LENGTH),
    Math.max(0, Math.abs(across) - HAMMER_HALF_WIDTH)) - target.radius;
}

/** Reads combat geometry; it cannot change a body, weapon, HP or game RNG. */
export class BladeHype {
  private warned = new Set<string>();

  constructor(private ctx: GameContext) {}

  hit(attacker: Fighter, target: Fighter, weapon: Weapon,
    x: number, y: number, kill: boolean, fighters: Fighter[]): void {
    const owner = subject(attacker);
    if (!kill) return;
    const opposingSurvivor = fighters.some(fighter => fighter.alive && fighter.hp > 0
      && fighter.group !== attacker.group);
    if (target.isStreamer || !opposingSurvivor) {
      this.ctx.hype.decisive(x, y, owner);
    }
    this.ctx.hype.kill(x, y, owner);
    if (target.owner.crowned || target.id === this.ctx.setup.crownUserId) {
      this.ctx.hype.callout(x, y, { ...owner, text: 'DETHRONED' });
    }
  }

  observe(fighters: Fighter[], radius: number, time = 0): void {
    const alive = fighters.filter(fighter => fighter.alive);
    let leader = alive[0];
    for (const fighter of alive) {
      if (fighter.hp / fighter.maxHp > leader.hp / leader.maxHp) leader = fighter;
    }
    for (const target of alive) {
      const crowned = target.owner.crowned || target.id === this.ctx.setup.crownUserId;
      if (target !== leader && !crowned && alive.length > 2) continue;
      for (const attacker of alive) {
        if (attacker.group === target.group) continue;
        for (const weapon of attacker.weapons) {
          if (target.hp > weapon.damage * damageMultiplier(attacker, time)) continue;
          const before = gap(pose(attacker, weapon, radius, 0), target, true);
          const after = gap(pose(attacker, weapon, radius), target);
          const margin = target.radius * NEAR_MISS_RADII;
          if ((target === leader || crowned) && before > 0 && before <= margin && after > before) {
            this.ctx.hype.nearMiss(target.x, target.y, subject(target));
          }
          if (alive.length <= 2 && after > 0 && after <= margin && after < before
            && !this.warned.has(target.id)) {
            this.warned.add(target.id);
            this.ctx.hype.decisive(target.x, target.y, subject(target));
          }
        }
      }
    }
  }
}
