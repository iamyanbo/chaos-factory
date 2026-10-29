import { Container } from 'pixi.js';
import { Rng, type GameEvent, type RoundSetup } from '@chaos/shared';
import type { GameContext, GameDefinition } from '../games/contract';
import type { Audio } from './audio';
import { PhysicsWorld } from './physics';
import { Camera } from './camera';
import { Fx } from '../kit/fx';
import { Kit } from '../kit/kit';
import { HypeBus } from '../kit/hype';

/** Worker-safe services. Importing this module never loads Howler or WebAudio. */
export function headlessContext(
  definition: GameDefinition,
  setup: RoundSetup,
  emit: (event: GameEvent) => void
): GameContext {
  const silent = {
    muted: true,
    play() {},
    bounce() {},
    ringPass() {}
  } as unknown as Audio;
  return {
    setup, rng: new Rng(setup.seed),
    physics: new PhysicsWorld(0, definition.maxBodies),
    camera: new Camera(), fx: new Fx(), audio: silent, kit: new Kit(),
    stage: { bg: new Container(), world: new Container(), fx: new Container(),
      labels: new Container(), hudWorld: new Container(), hud: new Container() },
    hud: { setMetric() {}, setTeams() {}, announce() {} },
    headless: true, emit, hype: new HypeBus(emit, false)
  };
}
