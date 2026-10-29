import { Container, Text } from 'pixi.js';
import { label } from '../engine/render';
import type { Marble } from './marble';
interface Placement {marble:Marble;x:number;y:number;width:number;height:number;size:number}
export class Labels {
  private views=new Map<string,Text>();private pool:Text[]=[];
  constructor(private layer?:Container){}
  render(marbles:Marble[],preview=false):void{
    if(!this.layer)return;
    const placed:Placement[]=[];
    const sorted=marbles.filter(m=>m.alive&&!m.dormant&&m.showLabel!==false&&(preview||!m.staged))
      .sort((a,b)=>(b.labelPriority??0)-(a.labelPriority??0)||Number(b.isStreamer)-Number(a.isStreamer)||b.score-a.score);
    for(const m of sorted){
      if(placed.length===25)break;
      const size=m.labelSize??30,width=Math.min(430,m.owner.displayName.length*size*.56),height=size+10;
      // Give final contenders alternate rows so one close collision cannot hide a name.
      const rows=size>=40?4:1;
      for(let row=0;row<rows;row++){
        const p={marble:m,x:m.x,y:m.y-m.radius-10-row*height,width,height,size};
        if(placed.some(o=>Math.abs(o.y-p.y)<Math.max(o.height,p.height)&&Math.abs(o.x-p.x)<(o.width+p.width)/2+12))continue;
        placed.push(p);break;
      }
    }
    const visible=new Set(placed.map(p=>p.marble.id));
    for(const[id,v]of this.views)if(!visible.has(id)){v.visible=false;this.pool.push(v);this.views.delete(id);}
    for(const p of placed){const m=p.marble;let v=this.views.get(m.id);if(!v){v=this.pool.pop()??this.layer.addChild(label('',p.size,m.color));this.views.set(m.id,v);}
      v.visible=true;v.text=`${m.owner.displayName.slice(0,18)}${p.size<40&&m.owner.title?' · '+m.owner.title.slice(0,15):''}`;
      v.style.fill=m.color;v.style.fontSize=p.size;v.anchor.set(.5,1);v.position.set(p.x,p.y);
    }
  }
  destroy():void{for(const v of this.views.values())v.destroy();for(const v of this.pool)v.destroy();this.views.clear();this.pool=[];}
}
