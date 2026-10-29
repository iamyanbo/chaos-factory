import { deepStrictEqual } from 'node:assert';
import { resultSchema,type RoundResult } from '@chaos/shared';

/** Compare the JSON persistence format: absent optional fields and undefined agree. */
export function assertReplayResult(generated:RoundResult,recorded:RoundResult):void{
  const persisted=(result:RoundResult)=>resultSchema.parse(JSON.parse(JSON.stringify(result)));
  const actual=persisted(generated),stored=persisted(recorded);
  deepStrictEqual(actual.winner,stored.winner);deepStrictEqual(actual.highlights,stored.highlights);
  // The bridge adds wager-derived tags after simulation. Bets aren't game inputs.
  const gameplayStats=(result:RoundResult)=>Object.fromEntries(Object.entries(result.perUser).map(([id,row])=>[id,{...row,tags:row.tags.filter(tag=>tag!=='traitor')}]));
  deepStrictEqual(actual.standings,stored.standings);deepStrictEqual(actual.champion,stored.champion);deepStrictEqual(gameplayStats(actual),gameplayStats(stored));deepStrictEqual(actual.mvps,stored.mvps);
}
