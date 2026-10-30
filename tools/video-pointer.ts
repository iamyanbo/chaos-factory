import type { Page, Locator } from '@playwright/test';

export interface Point { x: number; y: number }
const FRAME_MS = 1000 / 60;

/** A restrained curve with zero speed and acceleration at both ends. */
export function pointerPoint(from: Point, to: Point, progress: number, bend: number): Point {
  const t = Math.max(0, Math.min(1, progress));
  const eased = t * t * t * (10 + t * (-15 + 6 * t));
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const arc = Math.sin(Math.PI * eased) * bend;
  return { x: from.x + dx * eased - dy / length * arc,
    y: from.y + dy * eased + dx / length * arc };
}

/** Actual trusted Playwright pointer input, paced by elapsed wall time. */
export class VideoPointer {
  constructor(private page: Page, private position: Point) {}

  async move(to: Point, milliseconds: number, bend = 24): Promise<void> {
    const from = this.position;
    const start = performance.now();
    while (true) {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / milliseconds);
      const point = pointerPoint(from, to, progress, bend);
      await this.page.mouse.move(point.x, point.y);
      if (progress === 1) break;
      await this.page.waitForTimeout(Math.max(1, FRAME_MS - (performance.now() - start - elapsed)));
    }
    this.position = to;
  }

  async click(locator: Locator, milliseconds = 680): Promise<void> {
    const rect = await locator.boundingBox();
    if (!rect || rect.y < 0 || rect.y + rect.height > 1080) throw new Error('Capture control is outside the viewport');
    await this.move({ x: rect.x + rect.width * .51, y: rect.y + rect.height * .53 }, milliseconds);
    await this.page.waitForTimeout(105);
    await this.page.mouse.down();
    await this.page.waitForTimeout(85);
    await this.page.mouse.up();
  }
}
