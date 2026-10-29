import type { BestTakeResult } from '../kit/take-types';
import type { Director } from './director';

export class TakeSearch {
  private generation = 0;
  private abort?: AbortController;

  private ready(d: Director): void {
    d.takePending = false;
    d.phaseTime = 0;
    if (d.options.practice && (d.ctx?.headless || d.options.skipCountdown)) d.enter('PLAY');
    else {
      d.phase = 'LOCK_COUNTDOWN';
      d.broadcast();
    }
  }

  cancel(director: Director): void {
    this.generation++;
    this.abort?.abort();
    this.abort = undefined;
    director.takePending = false;
  }

  prepare(director: Director): void {
    const d = director;
    if (!d.game.scoreTake || !d.hooks.chooseTake || !d.ctx
      || (!d.game.spectator && !d.game.audienceIndependent && !d.ctx.setup.participants.length)) {
      if (d.options.practice) this.ready(d);
      return;
    }
    this.cancel(d);
    const generation = this.generation;
    this.abort = new AbortController();
    d.takePending = true;
    d.phase = 'LOCK_COUNTDOWN';
    d.hooks.chooseTake(structuredClone(d.initialSetup!), this.abort.signal).then((selection: BestTakeResult) => {
      if (generation !== this.generation) return;
      d.bestTake = selection;
      d.roundSeed = selection.selectedSeed;
      d.preview(false);
      this.ready(d);
    }).catch(error => {
      if (generation !== this.generation) return;
      console.warn('Take search unavailable; using the requested seed.', error);
      this.ready(d);
    });
  }
}
