import type { Rng } from "@chaos/shared";
import { CENTER } from "../../kit/neon";
import { HAMMER_KNOCKBACK, HIT_KNOCKBACK, BLADE_RADIUS_FRACTION } from "./config";
import type { Fighter, Weapon, WeaponKind, WeaponPose } from "./types";

const BASE: Record<
  WeaponKind,
  { length: number; spin: number; damage: number }
> = {
  Sword: { length: 70, spin: 3, damage: 10 },
  Dagger: { length: 35, spin: 6, damage: 6 },
  Spear: { length: 110, spin: 1.8, damage: 14 },
  Hammer: { length: 50, spin: 2.2, damage: 18 },
};
export const WEAPON_KINDS: WeaponKind[] = [
  "Sword",
  "Dagger",
  "Spear",
  "Hammer",
];

export function createWeapon(kind: WeaponKind, id: number, rng: Rng): Weapon {
  const angle = rng.range(0, Math.PI * 2);
  return {
    id,
    kind,
    angle,
    previous: angle,
    ...BASE[kind],
    direction: rng.chance(0.5) ? -1 : 1,
    hits: 0,
    knockback: kind === "Hammer" ? HAMMER_KNOCKBACK : HIT_KNOCKBACK,
  };
}

export function scaleWeapon(weapon: Weapon, arenaRadius = 500): void {
  weapon.hits++;
  if (weapon.kind === "Sword") weapon.length = Math.min(140, weapon.length + 8);
  if (weapon.kind === "Dagger") weapon.spin = Math.min(12, weapon.spin + 0.6);
  if (weapon.kind === "Spear") weapon.damage = Math.min(28, weapon.damage + 2);
  if (weapon.kind === "Hammer") weapon.knockback = Math.min(HAMMER_KNOCKBACK * 1.6, weapon.knockback * 1.1);
  weapon.length = Math.min(weapon.length, arenaRadius * BLADE_RADIUS_FRACTION);
}

export function effectiveSpin(weapon: Weapon, time: number): number {
  return Math.min(BASE[weapon.kind].spin * 2, weapon.spin * 1.01 ** time);
}

export function weaponLabel(weapon: Weapon, arenaRadius = 500, time = 0): string {
  const capped = weapon.kind === 'Sword' ? weapon.length >= Math.min(140, arenaRadius * BLADE_RADIUS_FRACTION)
    : weapon.kind === 'Dagger' ? effectiveSpin(weapon, time) >= 12
    : weapon.kind === 'Spear' ? weapon.damage >= 28 : weapon.knockback >= HAMMER_KNOCKBACK * 1.6;
  const label = weapon.kind === 'Sword' ? `Sword ${Math.round(weapon.length)}px`
    : weapon.kind === 'Dagger' ? `Dagger ${effectiveSpin(weapon, time).toFixed(1)}rad/s`
    : weapon.kind === 'Spear' ? `Spear ${weapon.damage}dmg`
    : `Hammer x${(weapon.knockback / HAMMER_KNOCKBACK).toFixed(1)}`;
  return `${label}${capped ? ' MAX' : ''}`;
}

/** The part beyond the drawn arena wall is occluded and cannot hit anything. */
export function pose(
  owner: Fighter,
  weapon: Weapon,
  radius: number,
  fraction = 1,
): WeaponPose {
  const angle = weapon.previous + (weapon.angle - weapon.previous) * fraction;
  const x = owner.prevX + (owner.x - owner.prevX) * fraction;
  const y = owner.prevY + (owner.y - owner.prevY) * fraction;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ox = x - CENTER.x;
  const oy = y - CENTER.y;
  const dot = ox * dx + oy * dy;
  const wall = Math.max(
    0,
    -dot +
      Math.sqrt(Math.max(0, dot * dot + radius * radius - ox * ox - oy * oy)),
  );
  const length = Math.min(weapon.length, radius * BLADE_RADIUS_FRACTION);
  const end = Math.min(owner.radius + length, wall - 2);
  const start = Math.min(owner.radius + 3, end);
  return {
    owner,
    weapon,
    angle,
    ax: x + dx * start,
    ay: y + dy * start,
    bx: x + dx * end,
    by: y + dy * end,
    head: owner.radius + length + 16 < wall,
  };
}

export function pointSegmentDistanceSquared(
  x: number,
  y: number,
  p: WeaponPose,
): number {
  const dx = p.bx - p.ax;
  const dy = p.by - p.ay;
  const t = Math.max(
    0,
    Math.min(1, ((x - p.ax) * dx + (y - p.ay) * dy) / (dx * dx + dy * dy || 1)),
  );
  return (x - p.ax - dx * t) ** 2 + (y - p.ay - dy * t) ** 2;
}

export function bodyContact(p: WeaponPose, target: Pick<Fighter, 'x'|'y'|'radius'>): boolean {
  if (Math.hypot(p.bx - p.ax, p.by - p.ay) < 2) return false;
  if (p.weapon.kind !== "Hammer") {
    return (
      pointSegmentDistanceSquared(target.x, target.y, p) <=
      (target.radius + 3) ** 2
    );
  }
  if (!p.head) return false;
  const dx = target.x - p.bx;
  const dy = target.y - p.by;
  const along = Math.cos(p.angle) * dx + Math.sin(p.angle) * dy;
  const across = -Math.sin(p.angle) * dx + Math.cos(p.angle) * dy;
  return (
    Math.max(0, Math.abs(along) - 10) ** 2 +
      Math.max(0, Math.abs(across) - 17) ** 2 <=
    target.radius ** 2
  );
}

export function bladesContact(a: WeaponPose, b: WeaponPose): boolean {
  if (
    Math.hypot(a.bx - a.ax, a.by - a.ay) < 2 ||
    Math.hypot(b.bx - b.ax, b.by - b.ay) < 2
  )
    return false;
  const ax = a.bx - a.ax;
  const ay = a.by - a.ay;
  const bx = b.bx - b.ax;
  const by = b.by - b.ay;
  const cross = ax * by - ay * bx;
  if (Math.abs(cross) > 0.00001) {
    const dx = b.ax - a.ax;
    const dy = b.ay - a.ay;
    const t = (dx * by - dy * bx) / cross;
    const u = (dx * ay - dy * ax) / cross;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  const gap = Math.min(
    pointSegmentDistanceSquared(a.ax, a.ay, b),
    pointSegmentDistanceSquared(a.bx, a.by, b),
    pointSegmentDistanceSquared(b.ax, b.ay, a),
    pointSegmentDistanceSquared(b.bx, b.by, a),
  );
  return gap <= 36;
}

export function bodyContactPoint(
  p: WeaponPose,
  target: Pick<Fighter, 'x'|'y'|'radius'>,
): { x: number; y: number } {
  const dx = p.bx - p.ax;
  const dy = p.by - p.ay;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((target.x - p.ax) * dx + (target.y - p.ay) * dy) /
        (dx * dx + dy * dy || 1),
    ),
  );
  return { x: p.ax + dx * t, y: p.ay + dy * t };
}

export function parryPoint(
  a: WeaponPose,
  b: WeaponPose,
): { x: number; y: number } {
  const dx = a.bx - a.ax;
  const dy = a.by - a.ay;
  const bx = b.bx - b.ax;
  const by = b.by - b.ay;
  const cross = dx * by - dy * bx;
  if (Math.abs(cross) > 0.00001) {
    const t = ((b.ax - a.ax) * by - (b.ay - a.ay) * bx) / cross;
    const u = ((b.ax - a.ax) * dy - (b.ay - a.ay) * dx) / cross;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1)
      return { x: a.ax + dx * t, y: a.ay + dy * t };
  }
  const project = (x: number, y: number, p: WeaponPose) => {
    const vx = p.bx - p.ax,
      vy = p.by - p.ay;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((x - p.ax) * vx + (y - p.ay) * vy) / (vx * vx + vy * vy || 1),
      ),
    );
    return { x: p.ax + vx * t, y: p.ay + vy * t };
  };
  const pairs = [
    [{ x: a.ax, y: a.ay }, project(a.ax, a.ay, b)],
    [{ x: a.bx, y: a.by }, project(a.bx, a.by, b)],
    [{ x: b.ax, y: b.ay }, project(b.ax, b.ay, a)],
    [{ x: b.bx, y: b.by }, project(b.bx, b.by, a)],
  ];
  pairs.sort(
    (p, q) =>
      (p[0].x - p[1].x) ** 2 +
      (p[0].y - p[1].y) ** 2 -
      (q[0].x - q[1].x) ** 2 -
      (q[0].y - q[1].y) ** 2,
  );
  return {
    x: (pairs[0][0].x + pairs[0][1].x) / 2,
    y: (pairs[0][0].y + pairs[0][1].y) / 2,
  };
}

export function bodyBeforeParry(
  p: WeaponPose,
  target: Pick<Fighter, 'x'|'y'|'radius'>,
  contact: { x: number; y: number },
): boolean {
  if (!bodyContact(p, target)) return false;
  const length = Math.hypot(p.bx - p.ax, p.by - p.ay);
  const dx = (p.bx - p.ax) / length,
    dy = (p.by - p.ay) / length;
  const tx = target.x - p.ax,
    ty = target.y - p.ay;
  const projection = tx * dx + ty * dy;
  const perpendicular = tx * tx + ty * ty - projection * projection;
  const root = (target.radius + 3) ** 2 - perpendicular;
  if (root < 0) return false;
  const first = Math.max(0, projection - Math.sqrt(root));
  const clash = (contact.x - p.ax) * dx + (contact.y - p.ay) * dy;
  return first + 2 < clash;
}
