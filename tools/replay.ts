import { readFile } from 'node:fs/promises';
import { resultSchema } from '@chaos/shared';
import { simulate } from './simulation';
import { assertReplayResult } from './replay-compare';
const index=process.argv.indexOf('--file');if(index<0||!process.argv[index+1])throw new Error('Usage: npm run replay -- --file .data/replays/<game>-<seed>.json');
const stored=resultSchema.parse(JSON.parse(await readFile(process.argv[index+1],'utf8')));const setup=stored.replay.setup;if(!setup)throw new Error('This older replay has no saved setup; use a newly recorded round.');
if(stored.winner.kind==='void')throw new Error('Voided rounds were intentionally interrupted and do not have a completed gameplay result.');
const run=await simulate({game:setup.gameId,seed:setup.seed,setup,replay:stored.replay.inputs});assertReplayResult(run.result,stored);
console.log(`Verified ${setup.gameId}: ${JSON.stringify(run.result.winner)} in ${run.duration.toFixed(2)}s; ${stored.replay.inputs.length} recorded inputs.`);
