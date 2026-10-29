import type { Fighter } from './types';

export const RAGE_DAMAGE_FRACTION = 0.14;
export const RAGE_SECONDS = 5;
export const RAGE_DAMAGE_MULTIPLIER = 1.5;

/** Damage received charges rage. Damage during the power-up cannot recharge it. */
export class BossRage {
  charge = 0;
  until = 0;
  private previousHp: number;

  constructor(readonly boss: Fighter) {
    this.previousHp = boss.hp;
  }

  active(time: number): boolean {
    return this.boss.hp > 0 && time < this.until;
  }

  observe(time: number): boolean {
    const damage = Math.max(0, this.previousHp - this.boss.hp);
    this.previousHp = this.boss.hp;
    if (this.active(time) || this.boss.hp <= 0) return false;
    this.charge += damage / (this.boss.maxHp * RAGE_DAMAGE_FRACTION);
    if (this.charge < 1) return false;
    this.charge = 0;
    this.until = time + RAGE_SECONDS;
    return true;
  }

  fill(time: number): number {
    return this.active(time) ? (this.until - time) / RAGE_SECONDS : this.charge;
  }
}

export function damageMultiplier(fighter: Fighter, time: number): number {
  return fighter.rage?.active(time) ? RAGE_DAMAGE_MULTIPLIER : 1;
}
