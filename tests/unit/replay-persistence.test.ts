import { test, expect } from 'vitest';
import { simulate } from '../../tools/simulation';
import { assertReplayResult } from '../../tools/replay-compare';

test('a persisted Blade replay compares exactly after JSON serialization', async () => {
  const run = await simulate({game:'blade-brawl', seed:42, participants:8, format:'boss'});
  const saved = JSON.parse(JSON.stringify(run.result));
  const replay = await simulate({game:'blade-brawl', seed:42, setup:saved.replay.setup, replay:saved.replay.inputs});
  expect(() => assertReplayResult(replay.result, saved)).not.toThrow();
  saved.champion = {userId:'wrong',displayName:'Wrong champion',reason:'Changed'};
  expect(() => assertReplayResult(replay.result, saved)).toThrow();
});

test('replay comparison detects contribution and MVP changes', async () => {
  const run = await simulate({game:'blade-brawl', seed:42, participants:8, format:'boss'});
  const baseline = structuredClone(run.result);
  const id = Object.keys(baseline.perUser)[0];
  baseline.mvps = [{userId:id,title:'Fixture MVP',stat:'3 hits'}];
  const saved = structuredClone(baseline);
  saved.perUser[id].score++;
  expect(() => assertReplayResult(baseline, saved)).toThrow();
  saved.perUser[id].score--;
  saved.mvps[0].stat='Changed';
  expect(() => assertReplayResult(baseline, saved)).toThrow();
});

test('spectator replay comparison detects changed team standings', async () => {
  const run = await simulate({game:'multiplier-cascade',seed:42,participants:0});
  const saved = structuredClone(run.result);
  saved.standings![0].stat='Changed';
  expect(() => assertReplayResult(run.result,saved)).toThrow();
});
