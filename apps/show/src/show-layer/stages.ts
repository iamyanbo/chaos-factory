import type { GameInstance } from '../games/contract';

export interface RoundStage { name: string; startedAt?: number }
interface StageConfig { names: [string, string, string]; changes: [number, number] }
const STAGES: Record<string, StageConfig> = {
  'blade-brawl': { names: ['OPEN ARENA', 'CLOSING IN', 'FINAL CIRCLE'], changes: [40, 75] },
  'ring-escape': { names: ['CALM', 'SPEED UP', 'RED ZONE'], changes: [15, 30] },
  'pong-wars': { names: ['OPENING', 'SPLITS', 'SUDDEN DEATH'], changes: [30, 80] },
  'marble-race': { names: ['UPPER COURSE', 'MIDDLE COURSE', 'FINISH RUN'], changes: [40, 75] },
  'multiplier-cascade': { names: ['FIRST DROP', 'HOPPERS FILL', 'FIRST TO FIVE'], changes: [33, 120] },
  'light-cycles': { names: ['OPEN GRID', 'SPEED UP', 'WALLS CLOSE'], changes: [40, 70] },
  'peg-fever': { names: ['FIRST BALLS', 'BOARD CLEARS', 'FEVER'], changes: [40, 75] },
  'hot-potato': { names: ['PASS THE FUSE', 'DOUBLE BOMBS', 'SHORT FUSES'], changes: [40, 75] }
};

/** A common view of actual game stages; no stage transition applies a force. */
export class Stages {
  index = 0;
  elapsed = 0;
  rows: RoundStage[] = [];
  private gameId = '';
  private inspectedAt = -Infinity;
  private details?: Record<string, unknown>;

  reset(gameId: string): void {
    this.gameId = gameId;
    this.index = this.elapsed = 0;
    this.inspectedAt = -Infinity;
    this.details = undefined;
    const config = STAGES[gameId] ?? { names: ['OPENING', 'BUILD UP', 'FINALE'] };
    this.rows = config.names.map((name, index) => ({ name, startedAt: index ? undefined : 0 }));
  }

  update(time: number, game: GameInstance | undefined): boolean {
    this.elapsed = time;
    const config = STAGES[this.gameId];
    if (!config) return false;
    let next = time >= config.changes[1] ? 2 : time >= config.changes[0] ? 1 : 0;
    const physicalStage = ['marble-race', 'multiplier-cascade', 'peg-fever',
      'hot-potato'].includes(this.gameId);
    if (physicalStage && time - this.inspectedAt >= .25) {
      this.details = game?.inspect?.().details;
      this.inspectedAt = time;
    }
    const details = this.details;
    if (this.gameId === 'marble-race') {
      const checkpoints = details?.checkpoints as { times: number[] }[] | undefined;
      const crossed = (index: number) => checkpoints?.some(row => Number.isFinite(row.times[index])) ?? false;
      next = crossed(7) ? 2 : crossed(3) ? 1 : 0;
    }
    if (this.gameId === 'multiplier-cascade' && typeof details?.wave === 'number') next = Math.min(2, details.wave - 1);
    if (typeof details?.stage === 'number') next = Math.max(0, Math.min(2, details.stage));
    if (next <= this.index) return false;
    for (let index = this.index + 1; index <= next; index++) {
      const checkpoints = details?.checkpoints as { times: number[] }[] | undefined;
      const checkpointTime = this.gameId === 'marble-race'
        ? Math.min(...(checkpoints ?? []).map(row => row.times[index === 1 ? 3 : 7] ?? Infinity)) : Infinity;
      this.rows[index].startedAt = Number.isFinite(checkpointTime) ? checkpointTime
        : this.gameId === 'multiplier-cascade' && typeof details?.age === 'number' ? this.inspectedAt - details.age : time;
    }
    this.index = next;
    return true;
  }
}
