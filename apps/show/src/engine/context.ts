import { Container } from 'pixi.js';
import { Rng, type GameEvent, type RoundSetup } from '@chaos/shared';
import type { GameContext, GameDefinition, GameHud } from '../games/contract';
import { PhysicsWorld } from './physics';
import { Camera } from './camera';
import { Fx } from '../kit/fx';
import { Audio } from './audio';
import { Kit } from '../kit/kit';
import type { Layers } from './render';
import type { DramaSink } from '../kit/drama-types';
import { HypeBus } from '../kit/hype';
export function createContext(def:GameDefinition,setup:RoundSetup,options:{stage?:Layers;camera?:Camera;fx?:Fx;audio?:Audio;hud?:GameHud;emit?:(e:GameEvent)=>void;drama?:DramaSink}={}):GameContext{
  const stage=options.stage??{bg:new Container(),world:new Container(),fx:new Container(),labels:new Container(),hudWorld:new Container(),hud:new Container()};
  const emit = options.emit ?? (() => {});
  return {setup,rng:new Rng(setup.seed),physics:new PhysicsWorld(9.81,def.maxBodies),stage,camera:options.camera??new Camera(),fx:options.fx??new Fx(),audio:options.audio??new Audio(true),kit:new Kit(),headless:!options.stage,hud:options.hud??{setMetric(){},setTeams(){},announce(){}},emit,drama:options.drama,
    hype: new HypeBus(emit, Boolean(options.stage))};
}
