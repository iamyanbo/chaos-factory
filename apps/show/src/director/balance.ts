import type { Winner } from '@chaos/shared';
export class Balance {
  values:Record<string,number>={};private last='';private streak=0;
  get(id:string):number{return this.values[id]??.5;}
  update(id:string,winner:Winner):string|undefined{if(winner.kind!=='chat'&&winner.kind!=='streamer')return;const side=winner.kind;this.streak=side===this.last?this.streak+1:1;this.last=side;const amount=(side==='streamer'?1:-1)*(.08+(this.streak>=3?.1:0));this.values[id]=Math.max(.15,Math.min(.85,this.get(id)+amount));return this.streak>=3?side==='streamer'?'CHAT GETS REINFORCEMENTS':'STREAMER RAGE MODE':undefined;}
}
