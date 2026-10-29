import { Container } from 'pixi.js';
import type { Vec2 } from '@chaos/shared';
interface Viewport {left:number;top:number;right:number;bottom:number;minZoom:number}
export class Camera {
  trauma = 0; zoom = 1; targetZoom = 1; target: Vec2 = { x: 960, y: 540 }; private clock = 0; private punchAmount = 0;
  private baseZoom=.93;private centerY=480;
  private bottom=810;private frame?:{left:number;top:number;right:number;bottom:number};
  private viewport?:Viewport;private configuredViewport?:Viewport;
  private fixedFrame = false;
  private hypePoint: Vec2 = { x: 960, y: 540 };
  private hypeAmount = 0;
  private visualTarget: Vec2 = { x: 960, y: 540 };
  displayZoom = 1;
  constructor(private layer?: Container) {}
  shake(k: number): void { this.trauma = Math.min(1, this.trauma + k); }
  shakePixels(pixels: number): void { this.trauma = Math.max(this.trauma, Math.sqrt(Math.max(0, pixels) / 28)); }
  punch(k = .06): void { this.punchAmount = Math.max(this.punchAmount, k); }
  /** Short live emphasis is composed after the game's fixed/follow camera. */
  hypeFocus(point: Vec2, amount: number): void {
    this.hypePoint = point;
    this.hypeAmount = Math.max(0, Math.min(1, amount));
  }
  project(point: Vec2): Vec2 {
    return { x: 960 + (point.x - this.visualTarget.x) * this.displayZoom,
      y: this.centerY + (point.y - this.visualTarget.y) * this.displayZoom };
  }
  follow(target: Vec2, zoom = 1): void { this.frame=undefined;const v=this.viewport,z=Math.max(v?.minZoom??0,zoom)*this.baseZoom;this.target = v?{x:target.x+(960-(v.left+v.right)/2)/z,y:target.y+(this.centerY-(v.top+v.bottom)/2)/z}:target; this.targetZoom = Math.max(v?.minZoom??0,zoom); }
  setViewport(viewport?:Viewport):void{this.fixedFrame=false;this.configuredViewport=viewport;this.viewport=viewport;}
  fitBounds(left:number,top:number,right:number,bottom:number):void{this.frame={left,top,right,bottom};}
  reserve(zone:{x:number;y:number;w:number;h:number}):void{const v=this.configuredViewport;if(v){const overlaps=zone.w>0&&zone.h>0&&zone.x<v.right&&zone.x+zone.w>v.left&&zone.y<v.bottom&&zone.y+zone.h>v.top;this.viewport=overlaps?{...v,bottom:Math.max(v.top+300,Math.min(v.bottom,zone.y-10))}:v;this.bottom=1080;this.baseZoom=1;this.centerY=540;return;}const bottom=zone.w>0&&zone.h>0?Math.max(500,Math.min(1000,zone.y)):1000;this.bottom=bottom;this.baseZoom=Math.min(1,(bottom-140)/720);this.centerY=(140+bottom)/2;}
  update(dt: number): void {
    this.clock += dt; this.trauma = Math.max(0, this.trauma - dt * 1.6); this.punchAmount *= Math.exp(-dt * 7);
    if(this.frame){const f=this.frame,v=this.viewport,top=v?.top??245,bottom=v?.bottom??Math.min(880,this.bottom-10),left=v?.left??160,right=v?.right??1760,scale=Math.max(v?.minZoom??0,Math.min((right-left)/Math.max(1,f.right-f.left),(bottom-top)/Math.max(1,f.bottom-f.top)));this.target={x:(f.left+f.right)/2+(960-(left+right)/2)/scale,y:(f.top+f.bottom)/2+(this.centerY-(top+bottom)/2)/scale};this.targetZoom=scale/this.baseZoom;}
    this.zoom += ((this.targetZoom + this.punchAmount)*this.baseZoom - this.zoom) * Math.min(1, dt * 8);
    this.displayZoom = this.zoom * (1 + .4 * this.hypeAmount);
    this.visualTarget = { x: this.target.x + (this.hypePoint.x - this.target.x) * this.hypeAmount,
      y: this.target.y + (this.hypePoint.y - this.target.y) * this.hypeAmount };
    if (!this.layer) return;
    const power = this.trauma ** 2; this.layer.pivot.set(this.visualTarget.x, this.visualTarget.y); this.layer.scale.set(this.displayZoom);
    this.layer.position.set(960 + Math.sin(this.clock * 91) * 28 * power, this.centerY + Math.cos(this.clock * 73) * 22 * power);
    this.layer.rotation = this.fixedFrame ? 0 : Math.sin(this.clock * 49) * .026 * power;
  }
  reset(): void { this.frame=undefined;this.target = { x: 960, y: 540 }; this.targetZoom = 1; this.zoom = 1; this.trauma = 0; this.hypeAmount=0;this.displayZoom=1; }
  lockFrame(): void {
    this.fixedFrame = true;
    this.frame = undefined;
    this.target = { x: 960, y: 540 };
    this.targetZoom = this.zoom = 1;
    this.punchAmount = 0;
    this.viewport = undefined;
    this.baseZoom = 1;
    this.centerY = 540;
  }
}
