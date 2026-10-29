import { Graphics } from 'pixi.js';
import type { Marble } from './marble';

interface Parts {
  trails:Graphics[];body:Graphics;pupils:Graphics;shield:Graphics;
  appearance:string;trailColor:number;radius:number;
}
const parts=new WeakMap<Graphics,Parts>();

/** Keep the marble's geometry; animation changes transforms, not tessellation. */
export function updateMarbleView(root:Graphics,m:Marble,faction:boolean,time:number,v:{x:number;y:number}):void{
  let p=parts.get(root);
  if(!p){
    p={trails:Array.from({length:7},()=>new Graphics()),body:new Graphics(),pupils:new Graphics(),shield:new Graphics(),appearance:'',trailColor:-1,radius:-1};
    // Cached circles/eyes exceed Pixi's automatic vertex cutoff. Keep them in
    // the shared batch: blinking must not borrow a whole arena-sized buffer.
    p.body.context.batchMode='batch';
    for(const trail of [...p.trails].reverse())root.addChild(trail);
    root.addChild(p.body,p.pupils,p.shield);parts.set(root,p);
  }
  const r=m.radius,blink=!m.dormant&&Math.sin(time*1.7+m.color)>.997;
  const appearance=`${r}:${m.color}:${m.isStreamer}:${faction?m.owner.teamId:''}:${blink}`;
  if(p.appearance!==appearance){drawBody(p.body,m,faction,blink);p.appearance=appearance;}
  if(p.trailColor!==m.color){for(const trail of p.trails)trail.clear().circle(0,0,1).fill(m.color);p.trailColor=m.color;}
  for(let j=0;j<p.trails.length;j++){
    const trail=p.trails[j],i=j+1,point=m.trail[i];trail.visible=Boolean(point);
    if(point){trail.position.set(point.x-root.x,point.y-root.y);trail.scale.set(r*(1-i/10)*.7);trail.alpha=(1-i/8)*.18;}
  }
  if(p.radius!==r){
    p.pupils.clear();for(const ex of[-r*.34,r*.34])p.pupils.circle(ex,-r*.15,r*.12).fill(0x090d18);
    p.shield.clear().circle(0,0,r+8).stroke({color:0xb5eeff,width:4});p.radius=r;
  }
  p.pupils.visible=!blink;p.pupils.position.set(Math.max(-r*.1,Math.min(r*.1,v.x)),Math.max(-r*.1,Math.min(r*.1,v.y)));
  p.shield.visible=m.shield>time;p.shield.alpha=.65+Math.sin(time*10)*.2;
}

function drawBody(g:Graphics,m:Marble,faction:boolean,blink:boolean):void{
  const r=m.radius;g.clear();
  g.circle(2,5,r+2).fill({color:0x000000,alpha:.35});
  g.circle(0,0,r).fill(m.color).stroke({color:m.isStreamer?0xffd23f:0x05070f,width:m.isStreamer?5:4});
  g.circle(-r*.25,-r*.35,r*.4).fill({color:0xffffff,alpha:.17});
  if(m.owner.teamId&&faction){
    const sx=r*.35,sy=r*.5,shape=m.owner.teamId;
    if(shape==='red')g.poly([-sx,sy,0,sy-sx,sx,sy]).fill(0x05070f);
    else if(shape==='mint')g.rect(-sx/2,sy-sx/2,sx,sx).fill(0x05070f);
    else if(shape==='violet')g.poly([0,sy-sx,sx,sy,0,sy+sx,-sx,sy]).fill(0x05070f);
    else if(shape==='gold')g.star(0,sy,5,sx,sx/2).fill(0x05070f);
    else if(shape==='orange')g.regularPoly(0,sy,sx,6).fill(0x05070f);
    else g.circle(0,sy,sx/2).fill(0x05070f);
  }
  for(const ex of[-r*.34,r*.34])g.ellipse(ex,-r*.15,r*.25,blink?1:r*.32).fill(0xffffff);
  if(m.isStreamer)g.poly([-r*.6,-r-5,-r*.7,-r-18,-r*.2,-r-12,0,-r-24,r*.2,-r-12,r*.7,-r-18,r*.6,-r-5]).fill(0xffd23f).stroke({color:0x05070f,width:3});
}
