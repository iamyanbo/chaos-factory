import { Renderer, label } from '../engine/render';
import { createContext } from '../engine/context';
import { FixedLoop } from '../engine/loop';
import { Camera } from '../engine/camera';
import { Audio, type Sound } from '../engine/audio';
import { Fx } from '../kit/fx';
import { BaseGame } from '../kit/base-game';
import { games } from '../games/registry';
import type { Graphics } from 'pixi.js';
import type { GameContext, GameDefinition } from '../games/contract';
import type { Winner } from '@chaos/shared';
export class Sandbox extends BaseGame{
  private pieces:ReturnType<GameContext['kit']['track']>;
  constructor(ctx:GameContext,count=200){super(ctx,999999);this.pieces=ctx.kit.track(ctx,{x:130,y:120,width:1660,height:750,pegs:12});for(let i=0;i<count;i++){const m=this.spawn({userId:`ball${i}`,login:`ball${i}`,displayName:`FACTORY ${i}`,color:'#4db4ff'},180+i%33*48,150+Math.floor(i/33)*37,14);m.body.setGravityScale(.4,true);}}
  protected update():void{for(const m of this.alive())if(m.y>920){this.ctx.physics.move(m.body,this.ctx.rng.range(170,1730),140);m.body.setLinvel({x:0,y:0},true);}}
  protected finish():Winner{return{kind:'void',reason:'Sandbox'};}
  protected draw(g:Graphics):void{for(const p of this.pieces)if(p.kind==='peg')g.circle(p.x,p.y,8).fill(0x7383aa);else g.rect(p.x-p.w/2,p.y-p.h/2,p.w,p.h).fill(0x2a3150);}
}
export async function runSandbox(host:HTMLElement,params:URLSearchParams):Promise<void>{const renderer=new Renderer();await renderer.init(host);const camera=new Camera(renderer.scene);const fx=new Fx(renderer.stage.fx);const audio=new Audio(params.has('mute'));const def:GameDefinition={...games[0],maxBodies:300};let seed=Number(params.get('seed')??1);
  let ctx:GameContext,game:Sandbox;function reset(){game?.destroy();ctx?.physics.destroy();ctx=createContext(def,{mode:'cvs',seed:seed++,gameId:'sandbox',difficulty:.5,modifiers:[],participants:[],streamerName:'BOSS'},{stage:renderer.stage,camera,fx,audio});game=new Sandbox(ctx,params.get('sandbox')==='track'?60:200);game.start();}reset();
  const fps=label('',36,0x5ff2c4);fps.position.set(50,25);renderer.stage.hud.addChild(fps);const help=label('1–9 EFFECT LAB  ·  R NEW TRACK',32);help.position.set(50,1000);renderer.stage.hud.addChild(help);
  const loop=new FixedLoop(dt=>game.step(dt),(a,dt)=>{game.render(a);fx.update(dt);camera.update(dt);});fx.onHitStop=ms=>loop.hitStop(ms);
  const sounds:Sound[]=['pop','clack','slam','whoosh','coin','chime','charge','explosion','heartbeat'];addEventListener('keydown',e=>{void audio.unlock();if(e.key.toLowerCase()==='r')reset();const i=Number(e.key)-1;if(i>=0&&i<9){audio.play(sounds[i]);fx.burst(960,500,[0x4db4ff,0xffd23f,0xff4d5e][i%3],100,i===5?'confetti':'sparks');fx.text(960,450,sounds[i].toUpperCase());fx.ring(960,500,0x5ff2c4);camera.shake(.4);camera.punch();loop.hitStop(80);}});
  renderer.app.ticker.add(t=>{if(params.has('stress'))fx.burst(960,500,0xffd23f,Math.max(0,1500-fx.count),'confetti');loop.frame(t.deltaMS/1000);fps.text=`PHYSICS LAB  /  ${Math.round(renderer.app.ticker.FPS)} FPS  /  ${ctx.physics.entities.size} BODIES`;});}
