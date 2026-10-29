import { Application, Container, Graphics, Text } from 'pixi.js';
import { arenaFloor, backdrop, card, textStyle, TOY, worldToScreen } from '../kit/theme';

export interface Layers {
  bg: Container; world: Container; fx: Container; labels: Container; hudWorld: Container; hud: Container;
}
export const INK = TOY.color.ink;
export function label(text: string, size = 32, color = TOY.color.ink as number, display = false): Text {
  return new Text({ text, style: { ...textStyle(size, display), fill: color,
    stroke: display ? { color: TOY.color.ink, width: 5, join: 'round' } : undefined } });
}
export function panel(g: Graphics, x: number, y: number, width: number, height: number,
  _fill?: number, _radius?: number): void { card(g, { x, y, width, height }); }

export class Renderer {
  readonly app = new Application();
  readonly root = new Container();
  readonly scene = new Container();
  readonly stage: Layers = { bg: new Container(), world: new Container(), fx: new Container(),
    labels: new Container(), hudWorld: new Container(), hud: new Container() };
  private board = new Container();
  private floor = new Container();
  private gameHud = new Container();
  private arenaMask = new Graphics();
  private arenaMasked?: boolean;
  private host?: HTMLElement;
  private observer?: ResizeObserver;

  private resize = () => {
    const width = this.host?.clientWidth ?? innerWidth;
    const height = this.host?.clientHeight ?? innerHeight;
    this.app.renderer.resize(width, height);
    const scale = Math.min(width / TOY.layout.width, height / TOY.layout.height);
    this.root.scale.set(scale);
    this.root.position.set((width - TOY.layout.width * scale) / 2, (height - TOY.layout.height * scale) / 2);
  };

  setIntermission(active: boolean): void {
    this.board.visible = !active;
    this.gameHud.visible = !active;
  }

  /** Games own transient score overlays; show cards remain on the global HUD. */
  get gameLayers(): Layers { return { ...this.stage, hud: this.gameHud }; }

  setArenaMask(enabled: boolean): void {
    if (this.arenaMasked === enabled) return;
    this.arenaMasked = enabled;
    this.arenaMask.visible = enabled;
    this.scene.mask = enabled ? this.arenaMask : null;
  }

  async init(host: HTMLElement, transparent = false): Promise<void> {
    await Promise.all([document.fonts.load(`54px "${TOY.font.display}"`),
      document.fonts.load(`500 26px "${TOY.font.body}"`), document.fonts.load(`700 26px "${TOY.font.body}"`)]);
    this.host = host;
    await this.app.init({ antialias: true, background: TOY.color.backgroundTop,
      backgroundAlpha: transparent ? 0 : 1, preference: 'webgl', autoDensity: true,
      resolution: Math.min(devicePixelRatio, 1.5) });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);
    this.board.scale.set(TOY.layout.worldScale);
    this.board.position.set(TOY.layout.centerX * (1 - TOY.layout.worldScale),
      TOY.layout.centerY * (1 - TOY.layout.worldScale));
    this.root.addChild(this.stage.bg, this.board, this.gameHud, this.stage.hud);
    this.board.addChild(this.floor, this.scene);
    this.scene.addChild(this.stage.world, this.stage.fx, this.stage.labels, this.stage.hudWorld);
    this.arenaMask.rect(TOY.layout.arenaLeft, 0, TOY.layout.arenaRight - TOY.layout.arenaLeft, TOY.layout.height)
      .fill(TOY.color.white);
    this.root.addChild(this.arenaMask);
    this.arenaMask.visible = false;
    this.background(transparent);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    addEventListener('resize', this.resize);
    this.resize();
  }

  background(transparent: boolean, _minimal = true, gameId = 'blade-brawl'): void {
    this.stage.bg.removeChildren().forEach(child => child.destroy());
    this.floor.removeChildren().forEach(child => child.destroy());
    if (!transparent) backdrop(this.stage.bg);
    const profile = TOY.boards[gameId as keyof typeof TOY.boards] ?? TOY.boards['blade-brawl'];
    const squareGrid = gameId === 'light-cycles';
    arenaFloor(this.floor, squareGrid ? 'square' : profile.shape,
      profile.x, profile.y, profile.width, profile.height, profile.rim);
    this.arenaMask.clear();
    if (squareGrid) {
      const point = worldToScreen(profile);
      this.arenaMask.rect(point.x, point.y, profile.width * TOY.layout.worldScale,
        profile.height * TOY.layout.worldScale).fill(TOY.color.white);
    } else if (profile.shape === 'panel' && gameId !== 'peg-fever') {
      const point = worldToScreen(profile);
      const inset = TOY.wall.rim / 2;
      this.arenaMask.roundRect(point.x + inset, point.y + inset,
        profile.width * TOY.layout.worldScale - inset * 2,
        profile.height * TOY.layout.worldScale - inset * 2, 24).fill(TOY.color.white);
    } else {
      // Open rings show real escapes; Peg's launcher sits across the top rim.
      this.arenaMask.rect(TOY.layout.arenaLeft, 0,
        TOY.layout.arenaRight - TOY.layout.arenaLeft, TOY.layout.height).fill(TOY.color.white);
    }
  }

  destroy(): void {
    this.observer?.disconnect();
    removeEventListener('resize', this.resize);
    this.app.destroy(true, { children: true });
  }
}
