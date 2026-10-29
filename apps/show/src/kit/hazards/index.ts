import type { GameContext } from '../../games/contract';
import type { RAPIER } from '../../engine/physics';
export class Hazard {
  remaining = 0; active = 0; cooldown = 0; owner = ''; body?: RAPIER.RigidBody;
  constructor(private ctx: GameContext, readonly kind: string, readonly x: number, readonly y: number, readonly w: number, readonly h: number) {}
  telegraph(sec = 1.5, owner = ''): boolean {
    if (this.remaining || this.active || this.cooldown) return false;
    this.remaining = Math.max(1.5, sec)*(this.ctx.setup.modifiers.includes('turbo')?1.35:1); this.owner = owner; this.ctx.audio.play('charge'); return true;
  }
  trigger(): void { this.remaining = 0; this.active = .28; this.ctx.fx.burst(this.x, this.y, 0xffd23f, 12); this.ctx.fx.ring(this.x, this.y, 0xff4d5e); this.ctx.camera.shake(.18); this.ctx.audio.play('slam'); }
  step(dt: number): boolean {
    this.cooldown = Math.max(0, this.cooldown - dt); let fired = false;
    if (this.remaining > 0) { this.remaining -= dt; if (this.remaining <= 0) { this.trigger(); fired = true; } }
    if (this.active > 0) { this.active = Math.max(0, this.active - dt); if (this.active === 0) this.cooldown = this.ctx.setup.modifiers.includes('double') ? 1.2 : 2; }
    return fired;
  }
  contains(x: number, y: number, margin = 0): boolean { return Math.abs(x - this.x) < this.w / 2 + margin && Math.abs(y - this.y) < this.h / 2 + margin; }
}
