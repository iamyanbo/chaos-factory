import { Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import { Rng } from '../engine/rng';
import { label } from '../engine/render';
import { TOY, toyColor } from './theme/toy';
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    color: number;
    size: number;
    kind: string;
    view: Sprite;
}
export class Fx {
    readonly graphics = new Graphics();
    private particles: Particle[] = [];
    private pool: Particle[] = [];
    private sprites = new Container();
    private texts: {
        view: Text;
        life: number;
        y: number;
    }[] = [];
    private rng = new Rng(892);
    private rings: {
        x: number;
        y: number;
        life: number;
        color: number;
        radius: number;
    }[] = [];
    private flashLife = 0;
    private flashColor = 0xffffff;
    private faces: {
        x: number;
        y: number;
        color: number;
        life: number;
    }[] = [];
    private slowLife = 0;
    private slowScale = 1;
    worldCaptions = true;
    onHitStop: (ms: number) => void = () => {
    };
    constructor(private layer?: Container) {
        layer?.addChild(this.sprites, this.graphics);
    }
    get count(): number {
        return this.particles.length;
    }
    get timeScale(): number {
        return this.slowLife > 0 ? this.slowScale : 1;
    }
    /** Presentation only: the simulation continues using its fixed 60 Hz clock. */
    slowMo(seconds = .22, scale = .4): void {
        if (this.slowLife > 0)
            return;
        this.slowLife = Math.max(0, Math.min(.8, seconds));
        this.slowScale = Math.max(.15, Math.min(1, scale));
    }
    burst(x: number, y: number, color: number, count = 16, kind = 'sparks'): void {
        if (!this.layer)
            return;
        for (let i = 0; i < count && this.particles.length < 1500; i++) {
            const p = this.pool.pop() ?? { view: new Sprite(Texture.WHITE) } as Particle;
            if (!p.view.parent)
                this.sprites.addChild(p.view);
            p.view.visible = true;
            p.view.tint = toyColor(color);
            const a = this.rng.range(0, Math.PI * 2);
            const speed = this.rng.range(60, kind === 'confetti' ? 450 : 280);
            Object.assign(p, { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 80, life: this.rng.range(.35, 1), max: 1, color, size: this.rng.range(3, 9), kind });
            this.particles.push(p);
        }
    }
    text(x: number, y: number, text: string, color = 0xffffff): void {
        if (!this.layer || !this.worldCaptions || this.texts.length >= 30)
            return;
        const view = label(text, 30, toyColor(color), true);
        view.anchor.set(.5);
        view.position.set(x, y);
        this.layer.addChild(view);
        this.texts.push({ view, life: .9, y });
    }
    ring(x: number, y: number, color: number, radius = 120): void {
        if (!this.layer || this.rings.some(r => r.color === color && r.life > .25 && Math.hypot(r.x - x, r.y - y) < 30))
            return;
        if (this.rings.length >= 40)
            this.rings.shift();
        this.rings.push({ x, y, life: .5, color, radius });
    }
    death(x: number, y: number, color: number): void {
        if (this.layer)
            this.faces.push({ x, y, color, life: .25 });
    }
    flash(color = 0xffffff): void {
        this.flashLife = .08;
        this.flashColor = color;
    }
    hitStop(ms: number): void {
        this.onHitStop(ms);
    }
    update(dt: number): void {
        this.slowLife = Math.max(0, this.slowLife - dt);
        const g = this.graphics.clear();
        this.faces = this.faces.filter(f => {
            f.life -= dt;
            if (f.life <= 0)
                return false;
            g.circle(f.x, f.y, 18).fill(toyColor(f.color)).stroke({ color: TOY.color.ink, width: 4 });
            for (const x of [-7, 7]) {
                g.moveTo(f.x + x - 4, f.y - 8).lineTo(f.x + x + 4, f.y).moveTo(f.x + x + 4, f.y - 8).lineTo(f.x + x - 4, f.y).stroke({ color: TOY.color.ink, width: 3 });
            }
            return true;
        });
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                p.view.visible = false;
                this.pool.push(p);
                this.particles[i] = this.particles[this.particles.length - 1];
                this.particles.pop();
                continue;
            }
            p.vy += dt * (p.kind === 'smoke' ? -50 : 370);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.view.position.set(p.x, p.y);
            p.view.width = p.size;
            p.view.height = p.size * (p.kind === 'confetti' ? 2 : 1);
            p.view.alpha = Math.min(1, p.life * 2);
        }
        this.rings = this.rings.filter(r => {
            r.life -= dt;
            if (r.life <= 0)
                return false;
            g.circle(r.x, r.y, 20 + (1 - r.life * 2) * (r.radius - 20)).stroke({ color: toyColor(r.color), width: 5, alpha: r.life * 2 });
            return true;
        });
        this.texts = this.texts.filter(t => {
            t.life -= dt;
            t.view.y = t.y - (1 - t.life / .9) * 70;
            t.view.alpha = Math.min(1, t.life * 3);
            if (t.life <= 0) {
                t.view.destroy();
                return false;
            }
            return true;
        });
        if (this.flashLife > 0) {
            this.flashLife -= dt;
            g.rect(0, 0, 1920, 1080).fill({ color: toyColor(this.flashColor), alpha: Math.max(0, this.flashLife / .08) * .25 });
        }
    }
    clear(): void {
        this.slowLife = 0;
        this.slowScale = 1;
        for (const p of this.particles)
            p.view.visible = false;
        this.pool.push(...this.particles);
        this.particles = [];
        this.rings = [];
        this.faces = [];
        for (const t of this.texts)
            t.view.destroy();
        this.texts = [];
        this.graphics.clear();
    }
    destroy(): void {
        this.clear();
        this.sprites.destroy({ children: true });
        this.graphics.destroy();
    }
}
