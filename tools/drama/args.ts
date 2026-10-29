import type { Mode } from '@chaos/shared';
import type { DramaOptions } from './runner';
export interface DramaCli extends DramaOptions {runs:number;seed:number;out:string}
/** Pure parsing so metrics tests never instantiate/import a game registry. */
export function parseDramaArgs(args:string[],lookup:(id:string)=>{modes:Mode[]}):DramaCli {
  const allowed=new Set(['--game','--runs','--seed','--participants','--teams','--mode','--competition','--out']),options=new Map<string,string>();
  for(let i=0;i<args.length;i+=2){if(!allowed.has(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Invalid/missing argument: ${args[i]}`);options.set(args[i],args[i+1]);}
  const game=options.get('--game');if(!game)throw new Error('Usage: npm run drama -- --game <id> --runs 200 [--participants 24 --teams 4 --seed 1 --out qa/report.md]');
  const def=lookup(game),integer=(key:string,fallback:number,min:number,max=Number.MAX_SAFE_INTEGER)=>{const n=Number(options.get(key)??fallback);if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`${key} must be an integer in [${min}, ${max}]`);return n;},mode=(options.get('--mode')??(def.modes.includes('faction')?'faction':def.modes[0])) as Mode;
  if(!def.modes.includes(mode))throw new Error(`Unsupported mode: ${mode}`);
  const competition=options.get('--competition')??'individual';if(competition!=='individual'&&competition!=='team')throw new Error('Competition must be individual or team');
  return {game,runs:integer('--runs',200,1),seed:integer('--seed',1,0,2147483647),participants:integer('--participants',24,1),teams:integer('--teams',4,2,6),mode,competition,out:options.get('--out')??`qa/drama-${game}.md`};
}
