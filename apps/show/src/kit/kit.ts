import { spawnMarble } from './marble';
import { buildTrack } from './track';

export class Kit {
  marble = spawnMarble;
  track = buildTrack;
}
