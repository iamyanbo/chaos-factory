import { expect, test } from "vitest";
import definition, { BladeBrawl } from "./index";
import { initPhysics } from "../../engine/physics";
import { headlessContext } from "../../engine/headless";
import { makeSetup, simulate } from "../../../../../tools/simulation";
import { bossHp, bossHpPerChatter, SPEED } from "./config";
import { createWeapon, scaleWeapon, parryPoint, effectiveSpin, weaponLabel } from "./weapons";
import { budgetKnockback } from './motion';
import { Rng } from "@chaos/shared";
import { Combat } from "./combat";
import type { Fighter } from "./types";
import { hitStop, PALETTE } from "../../kit/neon";
import { RAGE_SECONDS, RAGE_DAMAGE_FRACTION } from './rage';

async function scene(
  format: "boss" | "ffa" | "faction",
  count: number,
  work: (game: BladeBrawl) => void,
) {
  await initPhysics();
  const setup = makeSetup({
    game: definition.id,
    seed: 1,
    participants: count,
    mode: format === "faction" ? "faction" : "cvs",
  });
  setup.format = format;
  const ctx = headlessContext(definition, setup, () => {});
  const game = new BladeBrawl(ctx);
  try {
    work(game);
  } finally {
    game.destroy();
    expect(ctx.physics.entities.size).toBe(0);
    ctx.physics.destroy();
  }
}

test("the shared palette has twelve colors and hit stop is cosmetic", () => {
  expect(new Set(PALETTE).size).toBe(12);
  let frozen = 0;
  hitStop(
    {
      headless: false,
      fx: {
        hitStop: (ms: number) => {
          frozen = ms;
        },
      },
    } as never,
    60,
  );
  expect(frozen).toBe(60);
  hitStop(
    {
      headless: true,
      fx: {
        hitStop: () => {
          throw new Error("Headless freeze");
        },
      },
    } as never,
    100,
  );
});

test("all four weapons scale to the doc21 caps, including time-based spin", () => {
  const rng = new Rng(1);
  const sword = createWeapon("Sword", 0, rng),
    dagger = createWeapon("Dagger", 1, rng);
  const spear = createWeapon("Spear", 2, rng),
    hammer = createWeapon("Hammer", 3, rng);
  for (const w of [sword, dagger, spear, hammer]) scaleWeapon(w);
  expect(sword.length).toBe(78);
  expect(dagger.spin).toBeCloseTo(6.6);
  expect(spear.damage).toBe(16);
  expect(hammer.knockback).toBeCloseTo(1100);
  for (let hit = 0; hit < 200; hit++) {
    for (const weapon of [sword, dagger, spear, hammer]) scaleWeapon(weapon);
  }
  expect(sword.length).toBe(140);
  expect(dagger.spin).toBe(12);
  expect(effectiveSpin(dagger, 120)).toBe(12);
  expect(spear.damage).toBe(28);
  expect(hammer.knockback).toBe(1600);
  for (const weapon of [sword, dagger, spear, hammer]) expect(weaponLabel(weapon)).toContain('MAX');
  scaleWeapon(sword, 300);
  expect(sword.length).toBe(135);
});

test("Boss HP uses only one linear per-chatter constant at every required size", async () => {
  for (const count of [8, 16, 32])
    await scene("boss", count, (game) => {
      expect(game.marbles).toHaveLength(count + 1);
      const boss = game.marbles[0];
      expect(boss.radius).toBe(66);
      expect(boss.hp).toBe(bossHp(count));
      expect(boss.hp).toBe(Math.round(bossHpPerChatter * count));
      expect(boss.weapons.map((w) => w.kind)).toEqual(["Sword", "Hammer"]);
      expect(
        game.marbles
          .slice(1)
          .every((m) => m.radius === 22 && m.hp === 100 && !m.isStreamer),
      ).toBe(true);
      expect(game.ctx.physics.world.gravity).toEqual({ x: 0, y: 0 });
    });
});

function place(fighter: Fighter, x: number, y: number, angle: number) {
  fighter.x = fighter.prevX = x;
  fighter.y = fighter.prevY = y;
  fighter.weapons = [createWeapon("Sword", fighter.weapons[0].id, new Rng(1))];
  fighter.weapons[0].angle = fighter.weapons[0].previous = angle;
  fighter.weapons[0].direction = 1;
}

test('Boss rage charges from hits, buffs real weapon damage temporarily and cannot recharge while active', async () =>
  scene('boss', 1, game => {
    const [boss, target] = game.marbles;
    const rage = boss.rage!;
    const threshold = boss.maxHp * RAGE_DAMAGE_FRACTION;
    boss.hp -= threshold / 2;
    expect(rage.observe(1)).toBe(false);
    expect(rage.fill(1)).toBeCloseTo(.5);
    boss.hp -= threshold / 2 + .001;
    expect(rage.observe(2)).toBe(true);
    expect(rage.fill(2)).toBe(1);
    place(boss, 900, 540, 0);
    place(target, 1050, 540, Math.PI);
    target.weapons = [];
    const hooks = { hit() {}, parry() {} };
    new Combat().step(game.marbles, 500, 2, hooks);
    expect(target.hp).toBe(85);
    boss.hp -= 1;
    expect(rage.observe(3)).toBe(false);
    expect(rage.charge).toBe(0);
    expect(rage.fill(3)).toBeCloseTo(.8);
    expect(rage.active(2 + RAGE_SECONDS)).toBe(false);
    target.hp = 100;
    new Combat().step(game.marbles, 500, 2 + RAGE_SECONDS, hooks);
    expect(target.hp).toBe(90);
  }));

test("one body-contact episode deals one hit, with scaling and no friendly fire", async () =>
  scene("ffa", 2, (game) => {
    const [a, b] = game.marbles;
    place(a, 900, 540, 0);
    place(b, 980, 540, -Math.PI / 2);
    const combat = new Combat();
    const attackerVelocity = { ...a.body.linvel() };
    let hits = 0;
    const hooks = {
      hit() {
        hits++;
      },
      parry() {},
    };
    combat.step(game.marbles, 500, 0, hooks);
    expect(hits).toBe(1);
    expect(b.hp).toBe(90);
    expect(a.weapons[0].length).toBe(78);
    expect(a.body.linvel()).toEqual(attackerVelocity);
    let extraTravel = 0;
    for (let tick = 0; tick < 60; tick++) {
      const before = b.knockbackLeft ?? 0;
      budgetKnockback(b, 1 / 60);
      extraTravel += before - (b.knockbackLeft ?? 0);
    }
    expect(extraTravel).toBeLessThanOrEqual(b.radius * 1.5 + 1e-8);
    combat.step(game.marbles, 500, 0.01, hooks);
    expect(hits).toBe(1);
    expect(b.hp).toBe(90);
    b.group = a.group;
    b.hp = 100;
    new Combat().step(game.marbles, 500, 0.02, hooks);
    expect(b.hp).toBe(100);
  }));

test("a blade clash reverses both spins once and applies no damage", async () =>
  scene("ffa", 2, (game) => {
    const [a, b] = game.marbles;
    place(a, 900, 540, 0);
    place(b, 960, 600, -Math.PI / 2);
    const combat = new Combat();
    let parries = 0;
    const hooks = {
      hit() {
        throw new Error("Clash damage");
      },
      parry(
        x: Parameters<typeof parryPoint>[0],
        y: Parameters<typeof parryPoint>[1],
      ) {
        parries++;
        const p = parryPoint(x, y);
        expect(p.x).toBeCloseTo(960);
        expect(p.y).toBeCloseTo(540);
      },
    };
    combat.step(game.marbles, 500, 0, hooks);
    combat.step(game.marbles, 500, 0.01, hooks);
    expect(parries).toBe(1);
    expect(a.weapons[0].direction).toBe(-1);
    expect(b.weapons[0].direction).toBe(-1);
    expect(a.hp + b.hp).toBe(200);
  }));

test("a weapon cannot parry through the body that the attacker hits first", async () =>
  scene("ffa", 2, (game) => {
    const [a, b] = game.marbles;
    place(a, 900, 540, 0);
    place(b, 960, 540, 0);
    let hits = 0;
    new Combat().step(game.marbles, 500, 0, {
      hit() {
        hits++;
      },
      parry() {
        throw new Error("Clash hidden behind the victim body");
      },
    });
    expect(hits).toBe(1);
    expect(b.hp).toBe(90);
    expect(a.weapons[0].direction).toBe(1);
  }));

test('recontact cannot reverse a fighter pair again inside the 0.3s parry cooldown', async () =>
  scene('ffa', 2, game => {
    const [a, b] = game.marbles;
    const combat = new Combat();
    let parries = 0;
    const hooks = { hit() {}, parry() { parries++; } };
    const clash = (time: number) => {
      place(a, 900, 540, 0);
      place(b, 960, 600, -Math.PI / 2);
      combat.step(game.marbles, 500, time, hooks);
    };
    const separate = (time: number) => {
      place(a, 700, 540, 0);
      place(b, 1200, 540, 0);
      combat.step(game.marbles, 500, time, hooks);
    };
    clash(0);
    separate(.05);
    clash(.1);
    expect(parries).toBe(1);
    expect(a.weapons[0].direction).toBe(1);
    separate(.3);
    clash(.31);
    expect(parries).toBe(2);
    expect(a.weapons[0].direction).toBe(-1);
  }));

test('a fast blade catches an early clash and rebounds before entering the body',async()=>scene('ffa',2,game=>{
  const [a,b]=game.marbles;
  place(a,900,540,0);
  place(b,960,580,-Math.PI/2);
  a.weapons[0].previous=0;
  a.weapons[0].angle=1;
  b.weapons[0].length=35;
  let parries=0;
  new Combat().step(game.marbles,500,0,{
    hit(){throw new Error('Blade continued through its parry');},
    parry(){parries++;}
  });
  expect(parries).toBeGreaterThan(0);
  expect(a.weapons[0].direction).toBe(-1);
  expect(a.weapons[0].angle).toBeLessThan(0);
}));

test("all actual bodies stay inside the shrinking wall and retain their speed", async () =>
  scene("boss", 8, (game) => {
    for (const m of game.marbles) m.hp = m.maxHp = 1e9;
    game.start();
    for (let tick = 0; tick < 4600; tick++) {
      game.step(1 / 60);
      if (tick % 60 === 0)
        for (const m of game.marbles) {
          expect(
            Math.hypot(m.x - 960, m.y - 540) + m.radius,
          ).toBeLessThanOrEqual(game.radius + 1);
          const v = m.body.linvel();
          if (!m.knockbackLeft) expect(Math.hypot(v.x, v.y) * 50).toBeCloseTo(SPEED, 2);
        }
    }
    expect(game.radius).toBe(300);
  }));

test("the same seed and locked roster reproduce all three formats", async () => {
  for (const format of ["boss", "ffa", "faction"] as const) {
    const setup = makeSetup({
      game: definition.id,
      seed: 5,
      participants: 8,
      mode: format === "faction" ? "faction" : "cvs",
    });
    setup.format = format;
    const first = await simulate({
      game: definition.id,
      seed: 5,
      setup,
      replay: [],
    });
    const second = await simulate({
      game: definition.id,
      seed: 5,
      setup,
      replay: [],
    });
    expect(first.result).toEqual(second.result);
    expect(first.positions).toEqual(second.positions);
    expect(first.result.winner.kind).not.toBe("void");
  }
});
