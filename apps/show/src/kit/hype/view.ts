import { Container, Graphics } from 'pixi.js';
import type { Audio } from '../../engine/audio';
import type { Camera } from '../../engine/camera';
import type { Layers } from '../../engine/render';
import type { HypeEvent, HypeSink } from './types';
import { HypeParticles } from './particles';
import { ToyCallout, TOY, worldToScreen, arenaBounds } from '../theme';

const SLOW_SECONDS = 1.2;
const SLOW_SCALE = .3;
const CALLOUT_GAP = 2;
const CALLOUT_LIFE = .9;
const WIN_STAMP_SECONDS = 2;
const FLASH_SECONDS = .18;
const CALLOUT_MAX_WIDTH = 480;
const NEAR_MISS_SIZE = 40;
const NEAR_MISS_WIDTH = 180;

/** Real-time presentation of current events. No frame history or replay path. */
export class HypeView {
  readonly counts = { decisive: 0, nearMiss: 0, jackpot: 0, kill: 0, combo: 0, win: 0, callout: 0 };
  private root = new Container();
  private flash = new Graphics();
  private calloutStyle = new ToyCallout(this.root);
  private calloutText = this.calloutStyle.view;
  private winnerStyle = new ToyCallout(this.root);
  private winnerText = this.winnerStyle.view;
  private particles = new HypeParticles();
  private clock = 0;
  private slowRemaining = 0;
  private slowFocus = { x: 960, y: 540 };
  private calloutAt = -Infinity;
  private payoffAt = -Infinity;
  private eventPoint = { x: 960, y: 540 };
  private eventActor?: string;
  private nearMiss = false;
  private source?: HypeSink;
  private focusedCamera: Camera;
  private instrument: Audio;
  private gameId = '';
  private bounds = arenaBounds('blade-brawl');

  constructor(layers: Layers, camera: Camera, audio: Audio) {
    this.focusedCamera = camera;
    this.instrument = audio;
    layers.hud.addChild(this.root);
    layers.fx.addChild(this.particles.root);
    this.root.addChild(this.flash, this.calloutText, this.winnerText);
    this.flash.rect(0, 0, 1920, 1080).fill(TOY.color.white);
    this.winnerText.position.set(960, 460);
    this.reset();
  }

  get timeScale(): number { return this.slowRemaining > 0 ? SLOW_SCALE : 1; }
  get slowing(): boolean { return this.slowRemaining > 0; }
  get currentCallout() {
    return this.calloutText.visible ? { text: this.calloutText.text,
      x: this.calloutText.x, y: this.calloutText.y, width: this.calloutText.width,
      actor: this.eventActor, point: { ...this.eventPoint } } : undefined;
  }

  setArena(gameId: string): void {
    if (gameId === this.gameId) return;
    this.gameId = gameId;
    this.bounds = arenaBounds(gameId);
  }

  reset(): void {
    for (const key of Object.keys(this.counts) as (keyof typeof this.counts)[]) this.counts[key] = 0;
    this.source = undefined;
    this.slowRemaining = 0;
    this.calloutAt = this.payoffAt = -Infinity;
    this.eventActor = undefined;
    this.focusedCamera.hypeFocus(this.slowFocus, 0);
    this.flash.visible = this.calloutText.visible = this.winnerText.visible = false;
    this.particles.clear();
  }

  private callout(event: HypeEvent, text: string): void {
    if (this.clock - this.calloutAt < CALLOUT_GAP) return;
    this.calloutAt = this.clock;
    this.eventPoint = { x: event.x, y: event.y };
    this.nearMiss = event.kind === 'nearMiss';
    this.eventActor = this.nearMiss ? event.userId : undefined;
    this.calloutText.style.fontSize = this.nearMiss ? NEAR_MISS_SIZE : TOY.type.callout;
    this.calloutText.style.stroke = { color: TOY.color.ink, width: this.nearMiss ? 4 : 8, join: 'round' };
    this.calloutText.style.dropShadow = { color: TOY.color.ink, distance: this.nearMiss ? 3 : 10,
      angle: Math.PI / 2, blur: 0, alpha: 1 };
    this.calloutText.text = text;
    this.focusedCamera.shakePixels(3);
  }

  private receive(event: HypeEvent): void {
    this.counts[event.kind]++;
    if (event.kind === 'decisive') {
      this.slowFocus = { x: event.x, y: event.y };
      this.slowRemaining = SLOW_SECONDS;
    }
    if (event.kind === 'nearMiss') {
      this.instrument.play('whoosh');
      this.callout(event, 'SO CLOSE');
    }
    if (event.text) this.callout(event, event.text);
    if (event.kind === 'win') {
      this.payoffAt = this.clock;
      this.winnerText.text = event.name?.slice(0, 30) ?? 'WINNER!';
      this.winnerText.scale.set(1);
      this.winnerText.scale.set(Math.min(1, 1000 / Math.max(1, this.winnerText.width)));
      this.particles.fountain(event.x, event.y, event.color ?? 0xffd86b);
      this.instrument.hypePayoff();
      this.focusedCamera.shakePixels(4);
    }
  }

  update(dt: number, source: HypeSink | undefined, active = true,
    locate?: (id: string) => { x: number; y: number; alive?: boolean } | undefined): void {
    this.clock += dt;
    if (source !== this.source) { this.reset(); this.source = source; }
    for (const event of source?.drain() ?? []) if (active) this.receive(event);
    this.slowRemaining = Math.max(0, this.slowRemaining - dt);
    // The Race follow camera is already monotonic. A temporary finish zoom
    // moved the course down and then back up as it relaxed, resembling a rewind.
    // Keep live slow motion, but never displace or scale the gameplay camera.
    this.focusedCamera.hypeFocus(this.slowFocus, 0);
    const calloutAge = this.clock - this.calloutAt;
    this.calloutText.visible = active && calloutAge < CALLOUT_LIFE;
    if (this.calloutText.visible) {
      const actor = this.eventActor ? locate?.(this.eventActor) : undefined;
      if (actor?.alive === false) this.calloutText.visible = false;
      if (actor) this.eventPoint = { x: actor.x, y: actor.y };
      const point = worldToScreen(this.focusedCamera.project(this.eventPoint));
      this.calloutStyle.place(this.calloutText.text, point.x,
        this.nearMiss ? point.y : point.y - calloutAge * 35, calloutAge, this.bounds,
        this.nearMiss ? NEAR_MISS_WIDTH : CALLOUT_MAX_WIDTH);
      this.calloutText.alpha = Math.min(1, (CALLOUT_LIFE - calloutAge) * 4);
    }
    const payoffAge = this.clock - this.payoffAt;
    this.winnerText.visible = active && payoffAge < WIN_STAMP_SECONDS;
    if (this.winnerText.visible) this.winnerStyle.place(this.winnerText.text, 960, 460, payoffAge, this.bounds);
    this.winnerText.alpha = Math.min(1, (WIN_STAMP_SECONDS - payoffAge) * 4);
    this.flash.visible = active && payoffAge < FLASH_SECONDS;
    this.flash.alpha = .25 * Math.max(0, 1 - payoffAge / FLASH_SECONDS);
    this.particles.update(dt);
  }

  destroy(): void {
    this.particles.destroy();
    this.root.destroy({ children: true });
  }
}
