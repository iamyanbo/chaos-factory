import type { TeamId } from '@chaos/shared';
import type { CascadeBoard } from './board';
import type { Banking, DropResult, PocketHit, Unit } from './types';
import { GATE_Y } from './course-layout';

interface BankState {
  units: Map<string, Unit>;
  board: CascadeBoard;
  teams: TeamId[];
  scores: Map<TeamId, number>;
  bankings: Banking[];
  wave: number;
  time: number;
}

/** Validates real pocket contacts and preserves their scoring/audio order. */
export class PocketCollector {
  private lastCoin = 0;
  private chain = 0;

  collect(game: BankState, hits: PocketHit[],
    onBank: (unit: Unit, value: number) => void, onCoin: (note: number) => void): number {
    let banked = 0;
    for (const hit of hits) {
      const unit = game.units.get(hit.id);
      if (!unit || unit.stage !== GATE_Y.length) continue;
      const marble = unit.marble;
      const team = marble.team as TeamId;
      const bay = game.board.bay(game.teams.indexOf(team));
      const slot = Math.max(0, Math.min(2, Math.floor((marble.x - bay.left) / bay.w * 3)));
      if (hit.slot !== slot) continue;
      const value = game.board.pocketValue(slot);
      game.scores.set(team, game.scores.get(team)! + value);
      game.bankings.push({ wave: game.wave, team, id: marble.id, slot, value, time: game.time });
      banked++;
      onBank(unit, value);
    }
    if (banked > 0 && game.time - this.lastCoin > 0.09) {
      this.chain = game.time - this.lastCoin < 0.6 ? this.chain + 1 : 0;
      onCoin(3 + this.chain % 3);
      this.lastCoin = game.time;
    }
    return banked;
  }
}

export function summarizeDrop(game: BankState, before: Map<TeamId, number>, leaders: TeamId[],
  counts: Pick<DropResult, 'born' | 'banked' | 'lost' | 'expired'>): DropResult {
  return {
    wave: game.wave,
    points: Object.fromEntries(game.teams.map(team =>
      [team, game.scores.get(team)! - (before.get(team) ?? 0)])),
    totals: Object.fromEntries(game.scores),
    leaders,
    ...counts
  };
}
