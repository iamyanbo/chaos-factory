export class FixedLoop {
  timeScale = 1; paused = false; private accumulator = 0; private stopped = 0;
  constructor(private step: (dt: number) => void, private render: (alpha: number, realDt: number) => void) {}
  hitStop(ms: number): void { this.stopped = Math.max(this.stopped, ms / 1000); }
  frame(realDt: number): number {
    const dt = Math.min(.1, Math.max(0, realDt)); let steps = 0;
    if (this.stopped > 0) this.stopped = Math.max(0, this.stopped - dt);
    else if (!this.paused) {
      this.accumulator += dt * this.timeScale;
      while (this.accumulator >= 1 / 60 && steps < 5) { this.step(1 / 60); this.accumulator -= 1 / 60; steps++; }
      if (steps === 5) this.accumulator %= 1 / 60;
    }
    this.render(this.accumulator * 60, dt); return steps;
  }
}
