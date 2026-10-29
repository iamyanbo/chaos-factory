import { Container, Text } from 'pixi.js';
import type { GameContext } from '../contract';
import type { PegScoring } from './scoring';
import type { Landing, Shot } from './types';
import { SLOTS } from './config';
import { TOY, arenaBounds, worldToScreen } from '../../kit/theme';

const HOLD_SECONDS = .7;
const FLY_SECONDS = .85;
const MAX_STAMPS = 24;
const STAMP_ROW_GAP = 64;
const STAMP_ROWS = 7;
const LANDING_STAMP_Y = 950;
const COLUMN_CLEAR_SECONDS = 1.1;
const MAX_RECEIPT_WIDTH = 320;
const RECEIPT_MARGIN = 12;
const POP_OVERSHOOT = .12;
const LOCAL_RISE = 48;

interface Stamp {
  root: Container;
  math: Text;
  name: Text;
  landing: Landing;
  x: number;
  y: number;
  scale: number;
  aimed?: boolean;
  target?: { x: number; y: number };
}

/** Landing arithmetic is cosmetic; PegScoring is the only source of totals. */
export class LandingPayoffs {
  private root = new Container();
  private active: Stamp[] = [];
  private pool: Stamp[] = [];

  constructor(private ctx: GameContext) {
    ctx.stage.hud.addChild(this.root);
  }

  add(shot: Shot, landing: Landing): void {
    if (this.active.length >= MAX_STAMPS) this.recycle(this.active.shift()!);
    let stamp = this.pool.pop();
    if (!stamp) {
      const root = new Container();
      const math = new Text({ text: '', style: { fontFamily: TOY.font.display, fontSize: 36,
        fill: TOY.color.white, stroke: { color: TOY.color.ink, width: 6 } } });
      const name = new Text({ text: '', style: { fontFamily: TOY.font.body, fontSize: 24,
        fontWeight: '500', fill: TOY.color.white, stroke: { color: TOY.color.ink, width: 4 } } });
      math.anchor.set(.5);
      name.anchor.set(.5);
      name.y = 27;
      root.addChild(math, name);
      this.root.addChild(root);
      stamp = { root, math, name, landing, x: 0, y: 0, scale: 1 };
    }
    stamp.landing = landing;
    stamp.aimed = false;
    stamp.target = undefined;
    stamp.math.text = `${landing.run.toLocaleString()} ×${landing.multiplier} = ${landing.total.toLocaleString()}`;
    stamp.math.style.fill = landing.multiplier >= 10 ? TOY.color.yellow : TOY.color.white;
    stamp.name.text = `@${shot.name.slice(0, 22)}`;
    stamp.name.style.fill = TOY.color.white;
    stamp.scale = Math.min(1, MAX_RECEIPT_WIDTH / Math.max(stamp.math.width, stamp.name.width));
    const bounds = arenaBounds('peg-fever');
    const halfWidth = Math.max(stamp.math.width, stamp.name.width) * stamp.scale * (1 + POP_OVERSHOOT) / 2;
    stamp.x = Math.max(bounds.x + halfWidth + RECEIPT_MARGIN,
      Math.min(bounds.x + bounds.width - halfWidth - RECEIPT_MARGIN,
        worldToScreen({ x: SLOTS[landing.slot].center, y: 0 }).x));
    // Several balls can land in the same lane together. Give each receipt a
    // clear row before it flies into the sidebar instead of overprinting names.
    const nearby = this.active.filter(other => landing.time - other.landing.time < COLUMN_CLEAR_SECONDS
      && Math.abs(stamp.x - other.x) < (stamp.math.width * stamp.scale + other.math.width * other.scale) / 2 + 16);
    const rows = Array.from({ length: STAMP_ROWS }, (_, index) => LANDING_STAMP_Y - index * STAMP_ROW_GAP);
    stamp.y = rows.find(y => nearby.every(other => Math.abs(y - other.y) >= STAMP_ROW_GAP))
      ?? rows[nearby.length % rows.length];
    stamp.root.visible = true;
    this.active.push(stamp);
  }

  render(time: number, _scoring: PegScoring): void {
    for (let index = this.active.length - 1; index >= 0; index--) {
      const stamp = this.active[index];
      const age = Math.max(0, time - stamp.landing.time);
      if (age >= HOLD_SECONDS + FLY_SECONDS) {
        this.recycle(stamp);
        this.active.splice(index, 1);
        continue;
      }
      const flight = Math.max(0, Math.min(1, (age - HOLD_SECONDS) / FLY_SECONDS));
      const ease = flight * flight * (3 - 2 * flight);
      if (age >= HOLD_SECONDS && !stamp.aimed) {
        const owner = this.ctx.setup.participants[stamp.landing.owner]?.displayName ?? '';
        const target = this.ctx.hud.scoreTarget?.(owner);
        // Freeze an actual displayed score row. Unlisted players fade locally;
        // they must never fly into an invented sidebar row or change aim mid-flight.
        stamp.target = target ? { ...target } : undefined;
        stamp.aimed = true;
      }
      const target = stamp.target ?? { x: stamp.x, y: stamp.y - LOCAL_RISE };
      stamp.root.position.set(stamp.x + (target.x - stamp.x) * ease,
        stamp.y + (target.y - stamp.y) * ease - Math.sin(flight * Math.PI) * 70);
      const pop = 1 + Math.sin(Math.min(1, age / .22) * Math.PI) * POP_OVERSHOOT;
      stamp.root.scale.set(stamp.scale * pop * (1 - ease * .5));
      stamp.name.alpha = 1 - Math.min(1, flight * 3);
      stamp.root.alpha = 1 - ease;
    }
  }

  private recycle(stamp: Stamp): void {
    stamp.root.visible = false;
    this.pool.push(stamp);
  }

  destroy(): void { this.root.destroy({ children: true }); }
}
