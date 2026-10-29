import { Container, Sprite, Texture } from 'pixi.js';
import { Rng } from '@chaos/shared';
import { TOY, toyColor } from '../theme/toy';

interface Particle { view: Sprite; x: number; y: number; vx: number; vy: number; age: number; life: number }
const LIMIT = 240;
const GRAVITY = 340;

/** Bounded procedural confetti. Its private visual RNG never reaches a game. */
export class HypeParticles {
  readonly root = new Container();
  private active: Particle[] = [];
  private pool: Particle[] = [];
  private rng = new Rng(92471);

  fountain(x: number, y: number, color: number): void {
    for (let index = 0; index < 90 && this.active.length < LIMIT; index++) {
      let particle = this.pool.pop();
      if (!particle) {
        const view = new Sprite(Texture.WHITE);
        view.anchor.set(.5);
        this.root.addChild(view);
        particle = { view, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0 };
      }
      Object.assign(particle, { x, y, vx: this.rng.range(-270, 270),
        vy: this.rng.range(-600, -160), age: 0, life: this.rng.range(.7, 1.8) });
      particle.view.tint = index % 5 ? toyColor(color) : TOY.color.white;
      particle.view.width = this.rng.range(TOY.wall.outline, 10);
      particle.view.height = this.rng.range(TOY.wall.outline, 13);
      particle.view.rotation = this.rng.range(0, Math.PI);
      particle.view.visible = true;
      this.active.push(particle);
    }
  }

  update(dt: number): void {
    for (let index = this.active.length - 1; index >= 0; index--) {
      const particle = this.active[index];
      particle.age += dt;
      if (particle.age >= particle.life) {
        particle.view.visible = false;
        this.pool.push(particle);
        this.active.splice(index, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += GRAVITY * dt;
      particle.view.position.set(particle.x, particle.y);
      particle.view.alpha = 1 - particle.age / particle.life;
      particle.view.rotation += dt * 3;
    }
  }

  clear(): void {
    for (const particle of this.active) particle.view.visible = false;
    this.pool.push(...this.active);
    this.active = [];
  }

  destroy(): void { this.root.destroy({ children: true }); }
}
