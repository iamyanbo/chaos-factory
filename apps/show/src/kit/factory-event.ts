import type { Graphics } from 'pixi.js';
import { TEAMS,type TeamId,type Winner } from '@chaos/shared';
import type { GameContext } from '../games/contract';
import type { Marble } from './marble';
import { SpectatorGame } from './spectator-game';
import { SelectorBank,SELECTOR_GROUP } from './selector-bank';
import { RadialSiege,type SiegeOptions } from './radial-siege';

/** Shared visible selector/battle machinery; plugins own their resource rules. */
export abstract class FactoryEvent extends SpectatorGame {
  readonly selector:SelectorBank;readonly siege:RadialSiege;
  readonly damage=new Map<TeamId,number>();readonly decisions:number[][];
  constructor(ctx:GameContext,target:number,readonly choices:[string,string,string],options:SiegeOptions={}){
    super(ctx,target);ctx.physics.world.gravity.y=12.5;this.decisions=this.teams.map(()=>[0,0,0]);
    this.selector=new SelectorBank(ctx,this.teams.length,(m)=>{const i=this.teams.indexOf(m.team as TeamId),lane=this.selector.lane(m,i);this.decisions[i][lane]++;this.choose(m,lane);},3);
    this.siege=new RadialSiege(ctx,this.teams,(team,n)=>this.damage.set(team as TeamId,(this.damage.get(team as TeamId)??0)+n),options);
    for(const [i,t]of this.teams.entries())for(let n=0;n<4;n++){
      const p=this.selector.spawnPoint(i,n,4),m=this.machineBall(t,n,p.x,p.y);
      m.body.collider(0).setCollisionGroups(SELECTOR_GROUP);m.body.collider(0).setFriction(.025);m.body.collider(0).setRestitution(.4);m.body.setLinearDamping(.015);
    }
    ctx.camera.fitBounds(105,210,1620,895);
  }
  protected abstract choose(m:Marble,lane:number):void;
  protected abstract runFactory():void;
  protected abstract readout(i:number):string;
  protected update():void{
    for(const[i,t]of this.teams.entries())if(this.siege.core(t).hp<=0&&!this.selector.inactive.has(i))this.selector.retire(i,this.marbles.filter(m=>m.team===t));
    this.selector.step(this.time,this.marbles,m=>this.teams.indexOf(m.team as TeamId));this.siege.step(this.time);this.runFactory();
    this.teamProgress(t=>this.siege.core(t).hp/this.siege.core(t).maxHp);
    const alive=this.teams.filter(t=>this.siege.core(t).hp>0);
    if(this.time>10&&alive.length<=1){this.big(alive.length?'LAST CORE STANDING!':'MUTUAL DESTRUCTION!',this.siege.center.x,this.siege.center.y);this.close('Last core standing',this.siege.center.x,this.siege.center.y);this.complete(alive.length?this.winner(alive[0]):this.rankedWinner());}
    else if(this.time>this.target-3)this.close('Final volleys',this.siege.center.x,this.siege.center.y);
  }
  protected ranking(){return this.teams.map(teamId=>({teamId,remainingHp:this.siege.core(teamId).hp,score:this.siege.core(teamId).hp*1000000+Math.min(999999,this.damage.get(teamId)??0),stat:`${this.siege.core(teamId).hp} CORE HP · ${this.damage.get(teamId)??0} IMPACT PTS`}));}
  protected finish():Winner{this.big('FACTORY BELL!',this.siege.center.x,this.siege.center.y);return this.rankedWinner();}
  protected draw(g:Graphics):void{
    this.selector.draw(g);this.siege.draw(g);
    for(const[i,t]of this.teams.entries()){
      const b=this.selector.bay(i),p=this.siege.position(i),core=this.siege.core(t),color=core.hp?TEAMS[t].hex:0x72829c;
      this.text(`${TEAMS[t].shape} ${t.toUpperCase()}${core.hp?'':' · OUT'}`,b.x-b.w/2,b.y-34,28,color,i*6);
      for(let lane=0;lane<3;lane++)this.text(core.hp?this.choices[lane]:'',b.x-b.w/2+lane*b.w/3+3,b.y+b.h-37,28,[0xffd23f,0x5ff2c4,0xff5d73][lane],i*6+lane+1);
      this.text(core.hp?`${core.hp}/${core.maxHp}`:'OUT',p.x-48,p.y+35,28,color,i*6+4);
      this.text(core.hp?this.readout(i):'',p.x-78,p.y+65,28,color,i*6+5);
    }
  }
  protected debugInfo(){return{...this.selector.inspect(),...this.siege.inspect(),decisions:this.decisions.map(row=>[...row]),machineBallsPerTeam:4};}
}
