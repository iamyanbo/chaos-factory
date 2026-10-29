import { PX } from "../../engine/physics";
import { SPEED, HIT_FLASH_SECONDS, PARRY_COOLDOWN, MAX_KNOCKBACK_RADII, CONTACT_TRAVEL, MAX_CONTACT_SAMPLES } from "./config";
import {
  bladesContact,
  bodyBeforeParry,
  bodyContact,
  bodyContactPoint,
  parryPoint,
  pose,
  scaleWeapon,
} from "./weapons";
import type { Fighter, Weapon, WeaponPose } from "./types";
import { damageMultiplier } from './rage';

export interface CombatHooks {
  hit(
    attacker: Fighter,
    target: Fighter,
    weapon: Weapon,
    x: number,
    y: number,
    kill: boolean,
  ): void;
  parry(a: WeaponPose, b: WeaponPose): void;
}

export class Combat {
  private bodyTouches = new Set<string>();
  private bladeTouches = new Set<string>();
  private nextParry = new Map<string, number>();

  step(
    fighters: Fighter[],
    radius: number,
    time: number,
    hooks: CombatHooks,
  ): void {
    const travel = Math.max(0, ...fighters.filter(f => f.alive).flatMap(f =>
      f.weapons.map(w => Math.abs(w.angle - w.previous) * (f.radius + w.length))));
    const samples = Math.min(MAX_CONTACT_SAMPLES, Math.max(1, Math.ceil(travel / CONTACT_TRAVEL)));
    for (let index = 1; index <= samples; index++) {
      this.sample(fighters, radius, time, hooks, index / samples);
    }
  }

  private sample(fighters: Fighter[], radius: number, time: number,
    hooks: CombatHooks, fraction: number): void {
    const alive = fighters.filter((fighter) => fighter.alive);
    const at = (fighter: Fighter) => ({
      x: fighter.prevX + (fighter.x - fighter.prevX) * fraction,
      y: fighter.prevY + (fighter.y - fighter.prevY) * fraction,
      radius: fighter.radius
    });
    const weapons = alive.flatMap((owner) =>
      owner.weapons.map((weapon) => pose(owner, weapon, radius, fraction)),
    );
    const blades = new Set<string>();
    const bodies = new Set<string>();
    const parried = new Set<number>();
    const pending: { blade: WeaponPose; target: Fighter; damage: number }[] =
      [];
    for (let i = 0; i < weapons.length; i++) {
      const a = weapons[i];
      for (let j = i + 1; j < weapons.length; j++) {
        const b = weapons[j];
        if (a.owner.group === b.owner.group) continue;
        const reach =
          a.owner.radius +
          a.weapon.length +
          b.owner.radius +
          b.weapon.length +
          10;
        if (
          (a.owner.x - b.owner.x) ** 2 + (a.owner.y - b.owner.y) ** 2 >
          reach * reach
        )
          continue;
        if (!bladesContact(a, b)) continue;
        // A body in front of the clash absorbs the strike. Blades cannot parry
        // through their owners; treating that as a clash erased visible hits.
        const contact = parryPoint(a, b);
        if (
          bodyBeforeParry(a, at(b.owner), contact) ||
          bodyBeforeParry(b, at(a.owner), contact)
        )
          continue;
        const key = `${a.weapon.id}:${b.weapon.id}`;
        blades.add(key);
        parried.add(a.weapon.id);
        parried.add(b.weapon.id);
        if (this.bladeTouches.has(key)) continue;
        const pair = [a.owner.id, b.owner.id].sort().join(':');
        if ((this.nextParry.get(pair) ?? -Infinity) > time) continue;
        this.nextParry.set(pair, time + PARRY_COOLDOWN);
        for (const blade of [a,b]) {
          const travel = blade.weapon.angle - blade.weapon.previous;
          blade.weapon.previous += 2 * travel * fraction;
          blade.weapon.angle = blade.weapon.previous - travel;
          blade.weapon.direction *= -1;
        }
        hooks.parry(a, b);
      }
    }
    for (const blade of weapons) {
      if (!blade.owner.alive) continue;
      for (const target of alive) {
        if (!target.alive || blade.owner.group === target.group) continue;
        const reach =
          blade.owner.radius + blade.weapon.length + target.radius + 20;
        if (
          (blade.owner.x - target.x) ** 2 + (blade.owner.y - target.y) ** 2 >
          reach * reach
        )
          continue;
        if (!bodyContact(blade, at(target))) continue;
        const key = `${blade.weapon.id}:${target.id}`;
        bodies.add(key);
        if (this.bodyTouches.has(key) || parried.has(blade.weapon.id)) continue;
        pending.push({ blade, target, damage: blade.weapon.damage * damageMultiplier(blade.owner, time) });
      }
    }
    const velocities = new Map<Fighter, { x: number; y: number }>();
    for (const { blade, target, damage } of pending) {
      target.hp = Math.max(0, target.hp - damage);
      target.flashUntil = time + HIT_FLASH_SECONDS;
      const dx = target.x - blade.owner.x;
      const dy = target.y - blade.owner.y;
      const distance = Math.hypot(dx, dy) || 1;
      const velocity = velocities.get(target) ?? {
        x: target.body.linvel().x * PX,
        y: target.body.linvel().y * PX,
      };
      velocity.x += (dx / distance) * blade.weapon.knockback;
      velocity.y += (dy / distance) * blade.weapon.knockback;
      velocities.set(target, velocity);
      target.knockbackLeft = target.radius * MAX_KNOCKBACK_RADII;
      scaleWeapon(blade.weapon, radius);
    }
    for (const [target, velocity] of velocities) {
      const speed = Math.hypot(velocity.x, velocity.y) || 1;
      const impactSpeed = Math.max(SPEED, speed);
      target.body.setLinvel(
        {
          x: ((velocity.x / speed) * impactSpeed) / PX,
          y: ((velocity.y / speed) * impactSpeed) / PX,
        },
        true,
      );
    }
    const deaths = new Set<string>();
    for (const { blade, target } of pending) {
      const kill = target.hp <= 0 && !deaths.has(target.id);
      if (kill) deaths.add(target.id);
      const p = bodyContactPoint(blade, at(target));
      hooks.hit(blade.owner, target, blade.weapon, p.x, p.y, kill);
    }
    this.bodyTouches = bodies;
    this.bladeTouches = blades;
  }
}
