import { expect,test } from 'vitest';
import { initPhysics } from '../../apps/show/src/engine/physics';
import { createContext } from '../../apps/show/src/engine/context';
import { registry } from '../../apps/show/src/games/registry';
import { makeSetup } from '../../tools/simulation';
test('hazards recover to exactly zero and can fire repeatedly',async()=>{await initPhysics();const def=registry.get('blade-brawl')!,ctx=createContext(def,makeSetup({game:def.id,seed:1}));const h=ctx.kit.hazard(ctx,'crusher',0,0,10,10);try{expect(h.telegraph(.2)).toBe(true);expect(h.remaining).toBe(1.5);let fired=0;for(let i=0;i<300;i++)fired+=Number(h.step(1/60));expect(fired).toBe(1);expect(h.active).toBe(0);expect(h.telegraph(1.5)).toBe(true);}finally{ctx.physics.destroy();}});
test('turbo preserves the minimum real-time chat telegraph',async()=>{await initPhysics();const def=registry.get('blade-brawl')!,ctx=createContext(def,makeSetup({game:def.id,seed:1,modifiers:['turbo']}));try{const h=ctx.kit.hazard(ctx,'crusher',0,0,10,10);h.telegraph(1.5);expect(h.remaining/1.35).toBeGreaterThanOrEqual(1.5);}finally{ctx.physics.destroy();}});
