import { Rng, TEAMS, TEAM_IDS, type Mode, type RoundResult, type RoundSetup, type LoggedInput, type ChatGameInput } from '@chaos/shared';
import { initPhysics } from '../apps/show/src/engine/physics';
import { createContext } from '../apps/show/src/engine/context';
import { registry } from '../apps/show/src/games/registry';
import { isAutomatic } from '../apps/show/src/games/contract';
import type { BaseGame } from '../apps/show/src/kit/base-game';
import { BotDriver, createBotPolicy } from '../apps/show/src/kit/bots';
import { advanceGame, SIMULATION_LIMIT_SECONDS } from '../apps/show/src/engine/game-clock';
export interface SimOptions{format?:'boss'|'ffa'|'faction';game:string;seed:number;mode?:Mode;difficulty?:number;participants?:number;teams?:number;modifiers?:string[];replay?:LoggedInput[];delay?:[number,number];setup?:RoundSetup;observe?:(game:BaseGame)=>void}
export interface SimResult{result:RoundResult;duration:number;timeout:boolean;bodies:number;positions:number[]}
export function makeSetup(o:SimOptions):RoundSetup{
  const teams=TEAM_IDS.slice(0,o.teams??4);return{format:o.format,gameId:o.game,seed:o.seed,mode:o.mode??registry.get(o.game)!.modes[0],difficulty:o.difficulty??.5,modifiers:o.modifiers??[],streamerName:'FACTORY BOSS',teams,participants:Array.from({length:registry.get(o.game)!.spectator?0:o.participants??Math.min(registry.get(o.game)!.defaultBots??60,registry.get(o.game)!.maxParticipants)},(_,i)=>{const teamId=teams[i%teams.length];return{userId:`bot${i}`,login:`bot${i}`,displayName:`BOT ${i}`,color:TEAMS[teamId].color,...((o.mode??registry.get(o.game)!.modes[0])==='faction'?{teamId}:{})};})};
}
export async function simulate(o:SimOptions):Promise<SimResult>{
  await initPhysics();const def=registry.get(o.game);if(!def)throw new Error(`Unknown game: ${o.game}`);const setup=structuredClone(o.setup??makeSetup(o));if(def.spectator)setup.participants=[];const initialSetup=structuredClone(setup);const ctx=createContext(def,setup);const instance=def.create(ctx) as BaseGame;
  const driver=new BotDriver(createBotPolicy(o.game),o.seed,o.delay??[2.5,4.5]);const inputs:LoggedInput[]=[];const limits=new Map<string,number>();let tick=0;let replayIndex=0;let maxBodies=ctx.physics.entities.size;
  const chat=(input:ChatGameInput)=>{const spec=def.chatVerbs.find(v=>v.verb===input.verb);if(!spec)return;const key=`${input.userId}:${input.verb}`;if(tick/60*1000<(limits.get(key)??-1))return;limits.set(key,tick/60*1000+spec.cooldownMs);inputs.push({tick,kind:'chat',input});instance.onChat(input);};
  const replay=(item:LoggedInput)=>{if(item.kind==='chat')instance.onChat(item.input);else if(item.kind==='join')instance.onJoin(item.input);else instance.onStreamer(item.input);};
  try{
    // Bike course votes are planning inputs; they are replayed before the first simulation step.
    if(!o.replay&&o.game==='bike-down'){for(const user of setup.participants){const input=createBotPolicy(o.game).chat(instance,user,new Rng(o.seed).fork(user.userId));inputs.push({tick:0,kind:'chat',input});instance.onChat(input);}}
    if(o.replay)while(o.replay[replayIndex]?.tick===0)replay(o.replay[replayIndex++]);
    instance.start();
    while(tick<SIMULATION_LIMIT_SECONDS*60){tick++;
      if(o.replay){while(replayIndex<o.replay.length&&o.replay[replayIndex].tick===tick)replay(o.replay[replayIndex++]);}
      else driver.step(instance,1/60,chat,input=>{inputs.push({tick,kind:'streamer',input});instance.onStreamer(input);},!isAutomatic(def),!isAutomatic(def));
      advanceGame(instance,1/60,tick/60);o.observe?.(instance);maxBodies=Math.max(maxBodies,ctx.physics.entities.size);const state=instance.status();
      if(isAutomatic(def)&&tick%60===0)ctx.physics.world.forEachRigidBody(b=>{const p=b.translation(),v=b.linvel();if(!Number.isFinite(p.x+p.y+v.x+v.y))throw new Error('Non-finite assembly or projectile');});
      if(typeof state==='object'&&'done'in state){state.done.replay={seed:o.seed,inputs:o.replay??inputs,setup:initialSetup};return{result:structuredClone(state.done),duration:tick/60,timeout:false,bodies:maxBodies,positions:(instance.inspect?.().marbles??[]).filter(m=>m.alive).flatMap(m=>[m.x,m.y])};}
    }
    return{result:{winner:{kind:'void',reason:'Observation budget exhausted'},mvps:[],highlights:[],perUser:{},replay:{seed:o.seed,inputs}},duration:tick/60,timeout:true,bodies:maxBodies,positions:[]};
  }catch(error){console.error(`Simulation error: ${o.game}, seed ${o.seed}, tick ${tick}`,error);throw error;}finally{try{instance.destroy();}finally{ctx.physics.destroy();}}
}
