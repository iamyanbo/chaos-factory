import type { Graphics } from 'pixi.js';
import type { GameContext } from '../games/contract';
import { RAPIER } from '../engine/physics';
import { MachineGeometry } from './machine-geometry';
import { drawBody } from './draw-body';
export class ZigzagMachine {
  readonly geometry:MachineGeometry;readonly paddle:RAPIER.RigidBody;readonly gate:RAPIER.RigidBody;
  constructor(readonly ctx:GameContext,readonly stage:number){
    this.geometry=new MachineGeometry(ctx);const g=this.geometry;
    g.segment(120,410,1670,540,16,0x354968,.002);g.segment(1850,580,250,715,16,0x354968,.002);g.segment(160,762,1730,884,16,0x354968,.002);
    g.rail(1780,515,18,155);g.rail(150,720,18,130);g.rail(100,560,18,660);g.rail(1810,720,18,300);
    for(let i=0;i<6;i++)g.peg(650+i*150,397+i*12,8);
    this.paddle=ctx.physics.box(stage===2?1000:1200,stage===2?565:430,stage===2?140:110,12,{kinematic:true,entity:'race-paddle'});
    this.gate=ctx.physics.box(1400,stage===2?570:490,14,110,{kinematic:true,entity:'race-gate'});
  }
  step(t:number):void{this.paddle.setNextKinematicRotation(t*(this.stage===3?1.25:.7));const y=this.stage===2?570:490,phase=t%8,drop=phase<1?phase:phase<6?1:phase<7?7-phase:0;this.ctx.physics.move(this.gate,1400,y+135*drop);}
  draw(g:Graphics):void{
    for(let i=0;i<3;i++)g.roundRect(170,235+i*195,1580,190,18).fill({color:i===this.stage-1?0x1c3451:0x152238,alpha:i===this.stage-1?.4:.2});
    this.geometry.draw(g);const p=this.ctx.physics.position(this.paddle),gate=this.ctx.physics.position(this.gate);
    g.circle(p.x,p.y,65).stroke({color:0x6c839e,width:5,alpha:.3});drawBody(g,this.paddle,0xffd23f);g.circle(p.x,p.y,9).fill(0x090d18).stroke({color:0xffd23f,width:3});
    g.rect(1360,320,80,14).fill(0x536176);g.rect(1395,330,10,Math.max(10,gate.y-380)).fill(0x9badc5);drawBody(g,this.gate,0xff5d73);
    g.rect(1680,780,14,105).fill(0x5ff2c4);for(let i=0;i<4;i++)g.rect(1695,785+i*24,30,12).fill(i%2?0x5ff2c4:0xffffff);
  }
  destroy():void{for(const b of[this.geometry.body,this.paddle,this.gate])this.ctx.physics.remove(b);}
}

export class DownhillMachine {
  readonly geometry:MachineGeometry;readonly bridges:{x:number;body:RAPIER.RigidBody;drop:number}[]=[];
  readonly gates:{x:number;body:RAPIER.RigidBody}[]=[];readonly length:number;
  constructor(readonly ctx:GameContext,readonly bikes=false){
    this.length=bikes?6800:7600;this.geometry=new MachineGeometry(ctx);const g=this.geometry,gaps=bikes?[2100,4100]:[3100,6100];
    for(let x=0;x<this.length+1000;x+=100){if(gaps.some(gap=>x>=gap&&x<gap+200))continue;g.segment(x,this.height(x),x+100,this.height(x+100),18,0x354968,bikes?1.2:0);}
    g.rail(70,400,20,420);g.rail(this.length+240,this.height(this.length)-100,20,400);
    for(const[i,x]of gaps.entries())this.bridges.push({x:x+100,drop:(bikes?45:50)+i*10,body:ctx.physics.box(x+100,this.height(x+100),224,16,{kinematic:true,angle:.055,friction:bikes?1.2:0,entity:`bridge-${i}`})});
    if(!bikes){for(const x of[1700,2300,4500,5200,7400])g.peg(x,this.height(x)-64,12,0x9badc5);for(const x of[2400,5200])this.gates.push({x,body:ctx.physics.box(x,this.height(x)-60,16,120,{kinematic:true,entity:`pursuit-gate-${x}`})});}
  }
  height(x:number):number{return 490+x*.055;}
  step(t:number):void{for(const b of this.bridges){this.ctx.physics.move(b.body,b.x,this.height(b.x)+Math.max(0,t-b.drop)*140);b.body.setNextKinematicRotation(.055+(t>b.drop?Math.min(1,(t-b.drop)*.4):Math.sin(t*.7)*.008));}for(const gate of this.gates){const phase=(t+gate.x/1200)%10,lift=Math.max(0,Math.min(1,phase-1,8-phase));this.ctx.physics.move(gate.body,gate.x,this.height(gate.x)-60-lift*155);}}
  draw(g:Graphics,t:number):void{
    this.geometry.draw(g);for(const gate of this.gates){const y=this.height(gate.x),p=this.ctx.physics.position(gate.body);g.rect(gate.x-55,y-250,110,16).fill(0x536176);g.rect(gate.x-50,y-250,10,240).fill({color:0x354968,alpha:.6});g.rect(gate.x+40,y-250,10,240).fill({color:0x354968,alpha:.6});g.rect(gate.x-5,y-235,10,Math.max(5,p.y-60-(y-235))).fill(0x9badc5);drawBody(g,gate.body,0xff5d73);}
    for(const b of this.bridges){const y=this.height(b.x);g.poly([b.x-125,y+12,b.x-125,y+70,b.x-170,y+12]).fill(0x293c54);g.poly([b.x+125,y+12,b.x+125,y+70,b.x+170,y+12]).fill(0x293c54);drawBody(g,b.body,t>b.drop-1.5?0xff5d73:0xffd23f);g.circle(b.x,y,5).fill(0x090d18);if(t>b.drop-1.5&&t<b.drop)g.rect(b.x-105,y-12,210,8).fill({color:0xff4d5e,alpha:.5+.4*Math.sin(t*15)});}
    const y=this.height(this.length);g.rect(this.length,y-180,18,180).fill(0x5ff2c4);for(let i=0;i<6;i++)g.rect(this.length+18,y-180+i*25,70,12).fill(i%2?0x5ff2c4:0xffffff);
  }
}
