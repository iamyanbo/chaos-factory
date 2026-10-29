import { expect,test } from 'vitest';
import { initPhysics } from '../../apps/show/src/engine/physics';
import { createContext } from '../../apps/show/src/engine/context';
import { registry } from '../../apps/show/src/games/registry';
import { makeSetup } from '../../tools/simulation';
import { BaseGame } from '../../apps/show/src/kit/base-game';
import type { GameContext } from '../../apps/show/src/games/contract';

class SparseLabelsScene extends BaseGame {
  constructor(ctx:GameContext){super(ctx,60);this.spawn({userId:'viewer',login:'viewer',displayName:'VIEWER',color:'#ffffff'},960,500);}
  protected update():void{}
  protected draw():void{}
  protected finish(){return{kind:'void' as const,reason:'Fixture'};}
}
test('game teardown tolerates unused world-label slots',async()=>{
  await initPhysics();const def=registry.get('blade-brawl')!,ctx=createContext(def,makeSetup({game:def.id,seed:1})),game=new SparseLabelsScene(ctx);
  let destroyed=0;const slots:{destroy():void}[]=[];slots[20]={destroy:()=>destroyed++};(game as unknown as {texts:typeof slots}).texts=slots;
  expect(()=>game.destroy()).not.toThrow();expect(destroyed).toBe(1);expect(ctx.physics.entities.size).toBe(0);ctx.physics.destroy();
});
