import { describe, expect, test } from 'vitest';
import { registry } from '../../apps/show/src/games/registry';
import { simulate } from '../../tools/simulation';
import { resultSchema } from '@chaos/shared';
export function testGame(id:string):void{
  const def=registry.get(id)!;
  describe(id,()=>{
    for(const mode of def.modes)test(`${mode}: ends, respects body cap and replays exactly`,async()=>{const options={game:id,mode,seed:719,participants:24};const first=await simulate(options);expect(first.timeout).toBe(false);expect(first.duration).toBeLessThanOrEqual(def.durationSec.hardCap);expect(first.bodies).toBeLessThanOrEqual(def.maxBodies);expect(first.positions.every(Number.isFinite)).toBe(true);expect(resultSchema.safeParse(first.result).success).toBe(true);const again=await simulate({...options,replay:first.result.replay.inputs});expect(again.result).toEqual(first.result);expect(again.positions).toEqual(first.positions);});
    test('one participant and maximum roster both end',async()=>{for(const participants of [1,def.maxParticipants]){const sim=await simulate({game:id,seed:219,mode:def.modes[0],participants});expect(sim.timeout).toBe(false);expect(sim.result.winner.kind).not.toBe('void');expect(sim.bodies).toBeLessThanOrEqual(def.maxBodies);}});
    if(def.modes.includes('faction'))test('two and six teams with equal marble budgets',async()=>{for(const teams of[2,6]){const sim=await simulate({game:id,seed:101,mode:'faction',participants:36,teams});expect(sim.result.winner.kind).toBe('team');expect(sim.timeout).toBe(false);}});
    if(def.modes.includes('cvs'))test.runIf(process.env.CHAOS_BALANCE==='1')('200-seed CvS bot balance stays within 40–60%',async()=>{let wins=0;for(let seed=1;seed<=200;seed++){const run=await simulate({game:id,seed,mode:'cvs'});expect(run.timeout).toBe(false);wins+=Number(run.result.winner.kind==='streamer');}expect(wins).toBeGreaterThanOrEqual(80);expect(wins).toBeLessThanOrEqual(120);},600000);
  });
}
