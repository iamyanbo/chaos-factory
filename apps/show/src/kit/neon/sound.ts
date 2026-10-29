import type { GameContext } from "../../games/contract";

export class NeonSound {
  private note = 0;
  private octave = 0;

  constructor(private ctx: GameContext) {}

  setOctave(octave: number): void {
    this.octave = octave;
  }

  bounce(speed: number): void {
    if (!this.ctx.headless)
      this.ctx.audio.bounce(this.note++, speed, this.octave);
  }

  pass(depth: number): void {
    if (!this.ctx.headless) this.ctx.audio.ringPass(depth, this.octave);
  }

  hit(speed: number, damage: number, kill = false): void {
    if (!this.ctx.headless) this.ctx.audio.weaponHit(speed, damage, kill);
  }

  parry(speed: number): void {
    if (!this.ctx.headless) this.ctx.audio.parry(speed);
  }
}

/** Presentation-only. Headless simulations always retain the identical 60Hz physics clock. */
export function hitStop(ctx: GameContext, milliseconds = 60): void {
  if (!ctx.headless) ctx.fx.hitStop(Math.max(40, Math.min(100, milliseconds)));
}
