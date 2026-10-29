import { Rng, type ChatGameInput, type Participant, type StreamerInput } from '@chaos/shared';
import type { BaseGame } from './base-game';
import { SPECS } from '../games/catalog';
export interface BotPolicy { chat(game: BaseGame, user: Participant, rng: Rng): ChatGameInput; streamer(game: BaseGame, rng: Rng): string[] }
export function createBotPolicy(id: string): BotPolicy {
  if(SPECS[id]?.joinOnly||SPECS[id]?.spectator)return{chat:(_game,user)=>({userId:user.userId,teamId:user.teamId,verb:SPECS[id].spectator?'watch':'join'}),streamer:()=>[]};
  return {
    chat(game,user,rng) {
      const hero=game.marbles.find(m=>m.isStreamer&&m.alive);let verb='go';let arg:number|undefined;
      switch(id){
        case 'crusher-run':verb=rng.chance(.2)?'shield':'go';break;
        case 'collision-royale':verb=rng.chance(.75)?'charge':'anchor';break;
        case 'grand-prix':verb=rng.pick(['left','right','boost']);break;
        case 'color-conquest':verb='join';break;
        case 'gauntlet':verb='slam';break;
        case 'core-siege':verb=rng.chance(.7)?'fire':rng.pick(['left','right']);break;
        case 'pinball':verb='tilt';break;
        case 'meteor-dodge':verb=String(hero&&rng.chance(.5)?Math.max(1,Math.min(12,Math.floor((hero.x-180)/130)+1)):rng.int(1,12));break;
        case 'lava-rise':verb=String(rng.int(1,9));break;
        case 'hot-potato':verb='pass';break;
        case 'derby':verb='cheer';break;
        case 'trapdoor':{const tiles=(game as BaseGame&{tiles:{open:number;warning:number;permanent:boolean}[]}).tiles;const columns=Array.from({length:12},(_,i)=>i).filter(c=>tiles.slice(c,c+1).some(t=>!t.permanent&&t.open<=game.time&&!t.warning));verb=String.fromCharCode(97+rng.pick(columns.length?columns:[5,6]));break;}
        case 'multiply':verb=rng.pick(['left','right']);break;
        case 'cannon-clash':verb='aim';arg=rng.int(35,55);break;
        case 'tree-war':case 'bike-down':verb=String(rng.int(1,3));break;
      }
      return{userId:user.userId,teamId:user.teamId,verb,arg};
    },
    streamer(game,rng){
      const hero=game.marbles.find(m=>m.isStreamer&&m.alive);const t=game.time;
      const extra=game as BaseGame & {hazards?:{x:number;y:number;remaining:number;active:number;contains(x:number,y:number,margin?:number):boolean}[];warnings?:{column:number;at:number}[];floor?:unknown[];platforms?:{x:number;y:number;body?:unknown;crack:number}[];current?:{translation():{x:number;y:number}};frame?:{rotation():number};forts?:{team:string;angle:number}[]};
      switch(id){
        case 'crusher-run':return [...(extra.hazards??[]).flatMap((h,i)=>game.marbles.some(m=>m.alive&&Math.abs(m.x-h.x)<190&&m.y>240&&m.y<560)?[`slam${i+1}`]:[]),...(Math.floor(t)%9===0?['pulse']:[])];
        case 'collision-royale':return hero?[...(hero.x>980?['left']:hero.x<940?['right']:[]),...(hero.y>530?['up']:hero.y<490?['down']:[]),'pulse']:[];
        case 'grand-prix':{const target=(game as BaseGame&{nudgeTarget():number}).nudgeTarget();return hero?(hero.x<target-55?['right']:hero.x>target+55?['left']:[]):[];}
        case 'color-conquest':return[];
        case 'gauntlet':{const next=hero&&(extra.hazards??[]).find(h=>h.x>hero.x&&h.x<hero.x+220&&(h.remaining>0||h.active>0));if(next)return[];const danger=hero&&(extra.hazards??[]).some(h=>h.remaining>0&&h.x>hero.x-150&&h.x<hero.x+100);return['right',...(danger?['jump','dash']:[])];}
        case 'core-siege':return['laser','overcharge',...(Math.floor(t/3)%2?['left']:['right'])];
        case 'pinball':return[...(t%1.1<.8?['left']:[]),...(t%1.3<.9?['right']:[]),'kickback'];
        case 'meteor-dodge':{if(!hero)return[];const floor=extra.floor??[];const warnings=extra.warnings??[];const options=floor.map((f,i)=>({f,x:245+i*130,i})).filter(o=>o.f&&!warnings.some(w=>w.column===o.i));options.sort((a,b)=>Math.abs(a.x-hero.x)-Math.abs(b.x-hero.x));const x=options[0]?.x??960;const moving=Math.abs(x-hero.x)>15;return[...(hero.x<x-15?['right']:hero.x>x+15?['left']:[]),...(moving||warnings.some(w=>Math.abs(245+w.column*130-hero.x)<140)?['jump']:[]),...(Math.abs(x-hero.x)>180?['dash']:[])];}
        case 'lava-rise':{if(!hero)return[];const target=(extra.platforms??[]).filter(p=>p.body&&!p.crack&&p.y<hero.y-30&&p.y>hero.y-310).sort((a,b)=>b.y-a.y)[0];return[...(target?hero.x<target.x-25?['right']:hero.x>target.x+25?['left']:[]:[]),...(t%1.3<.35?['jump']:[])];}
        case 'trapdoor':return[Math.floor(t/4)%2?'left':'right',...(t%6<.2?['drop']:[])];
        case 'cannon-clash':{const f=extra.forts?.find(f=>f.team==='streamer');return['charge',...(f&&f.angle<43?['right']:f&&f.angle>47?['left']:[])];}
        case 'tree-war':return['card2','seed'];
        case 'bike-down':{const a=extra.frame?.rotation()??0;return['pedal',...(a>.08?['left']:a<-.08?['right']:[])];}
        default:return rng.chance(.1)?['pulse']:[];
      }
    }
  };
}
export class BotDriver {
  private rng:Rng;private due:{at:number;input:ChatGameInput}[]=[];private active=new Set<string>();private nextChat=0;private nextControl=0;private seq=0;
  constructor(readonly policy:BotPolicy,seed:number,readonly delay:[number,number]=[2.5,4.5]){this.rng=new Rng(seed).fork('bots');}
  release(send:(input:StreamerInput)=>void):void{for(const action of this.active)send({action,pressed:false,seq:++this.seq});this.active.clear();}
  step(game:BaseGame,dt:number,sendChat:(i:ChatGameInput)=>void,sendControl:(i:StreamerInput)=>void,chat=true,streamer=true,excludeUser?:string):void{
    const time=game.time;
    if(chat&&time>=this.nextChat){this.nextChat=time+3;for(const user of game.ctx.setup.participants)if(user.userId!==excludeUser&&this.rng.chance(.6))this.due.push({at:time+this.rng.range(...this.delay),input:this.policy.chat(game,user,this.rng)});}
    for(const item of this.due.filter(x=>x.at<=time))sendChat(item.input);this.due=this.due.filter(x=>x.at>time);
    if(streamer&&time>=this.nextControl){this.nextControl=time+.1;const desired=new Set(this.policy.streamer(game,this.rng));for(const action of this.active)if(!desired.has(action))sendControl({action,pressed:false,seq:++this.seq});for(const action of desired)if(!this.active.has(action))sendControl({action,pressed:true,seq:++this.seq});this.active=desired;}
  }
}
