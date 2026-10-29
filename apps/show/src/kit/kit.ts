import type { GameContext } from '../games/contract';
import { spawnMarble } from './marble';
import { Vote } from './vote';
import { Meter } from './meter';
import { buildTrack } from './track';
import { Hazard } from './hazards';
export class Kit {
  marble = spawnMarble;
  vote(options: string[]): Vote { return new Vote(options); }
  meter(window = 6, threshold = .55): Meter { return new Meter(window, threshold); }
  track = buildTrack;
  hazard(ctx: GameContext, kind: string, x: number, y: number, w: number, h: number): Hazard { return new Hazard(ctx, kind, x, y, w, h); }
}
