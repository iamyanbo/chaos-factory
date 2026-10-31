import type { Container } from 'pixi.js';
import type { HudState } from '../hud/hud';

const ENTER_SECONDS = .42;
const COUNT_POP_SECONDS = .2;
const REVEAL_SECONDS = .32;

/** Card motion and arena reveal are presentation only; the game has not started. */
export class RoundEntrance {
  private key = '';
  private elapsed = 0;
  private count = 0;
  private countElapsed = 0;

  update(root: Container, state: HudState, dt: number): number {
    const key = `${state.phase}:${state.selectingTake ?? false}:${state.game.id}`;
    if (key !== this.key) {
      this.key = key;
      this.elapsed = 0;
      this.count = 0;
    }
    this.elapsed += dt;
    this.countElapsed += dt;
    const entering = ['INTRO', 'LOBBY', 'LOCK_COUNTDOWN'].includes(state.phase);
    const progress = entering ? Math.min(1, this.elapsed / ENTER_SECONDS) : 1;
    const ease = 1 - Math.pow(1 - progress, 3);
    root.pivot.set(960, 540);
    root.position.set(960, 540 + 38 * (1 - ease));
    root.scale.set(.94 + .06 * ease);
    const countdown = state.phase === 'LOCK_COUNTDOWN' && !state.selectingTake;
    root.alpha = ease * (countdown ? Math.min(1, state.timeLeft / REVEAL_SECONDS) : 1);
    const count = countdown ? Math.ceil(state.timeLeft) : 0;
    if (count !== this.count) {
      this.count = count;
      this.countElapsed = 0;
    }
    const pop = Math.min(1, this.countElapsed / COUNT_POP_SECONDS);
    return 1 + .18 * Math.sin(pop * Math.PI);
  }

  get loadingTime(): number { return this.elapsed; }
}
