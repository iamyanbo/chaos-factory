import { Container, Text } from 'pixi.js';
import { label } from '../engine/render';
export class Announcer {
  private text:Text;private queue:{text:string;priority:number}[]=[];private elapsed=9;
  private drama=false;
  constructor(layer:Container,private compact=false){this.text=label('',compact?70:130,0xffd23f,true);this.text.anchor.set(.5);this.text.position.set(960,compact?280:455);this.text.visible=false;layer.addChild(this.text);}
  push(text:string,priority=1):void{if(this.queue.some(q=>q.text===text))return;this.queue.push({text,priority});this.queue.sort((a,b)=>b.priority-a.priority);this.queue=this.queue.slice(0,5);}
  setDrama(enabled:boolean):void{this.drama=enabled;this.text.position.set(enabled?1000:960,enabled?42:this.compact?280:455);if(enabled)this.text.style.fontSize=34;}
  update(dt:number):void{this.elapsed+=dt;if(this.elapsed>=1.5&&this.queue.length){const next=this.queue.shift()!;this.text.text=next.text;this.text.style.fontSize=this.drama?34:this.compact?(next.text.length>28?48:next.text.length>20?60:70):next.text.length>28?80:next.text.length>20?100:130;this.elapsed=0;}const t=this.elapsed;this.text.visible=t<1.3;this.text.scale.set(t<.16?.7+Math.sin(t/.16*Math.PI/2)*.4:1+Math.exp(-(t-.16)*20)*.1);this.text.alpha=t<1?1:Math.max(0,(1.3-t)/.3);this.text.rotation=t<.2?Math.sin(t*80)*.014:0;}
  clear():void{this.queue=[];this.elapsed=9;}
}
