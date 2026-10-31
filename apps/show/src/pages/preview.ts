import { Renderer } from '../engine/render';
import { games } from '../games/registry';
import { Hud, type HudState } from '../hud/hud';
import { TOY } from '../kit/theme';

/** Direct, read-only screen previews share the real round presenters without a bridge. */
export async function preview(host: HTMLElement): Promise<void> {
  document.body.className = 'show';
  const params = new URLSearchParams(location.search);
  const screen = params.get('screen') ?? 'lobby';
  const renderer = new Renderer();
  await renderer.init(host);
  const game = games.find(game => game.id === params.get('game')) ?? games[0];
  renderer.background(false, true, game.id);
  const names = ['neon_otter', 'cosmic_fox', 'tiny_moth', 'pixel_moth', 'sleepy_fox',
    'lucky_otter', 'spicy_moth', 'minty_fox', 'moon_otter', 'chaos_fox'];
  if (params.get('name')) names[0] = params.get('name')!;
  const state: HudState = {
    phase: screen === 'winner' || screen === 'void' ? 'RESULT'
      : screen === 'countdown' || screen === 'loading' ? 'LOCK_COUNTDOWN' : 'LOBBY',
    timeLeft: screen === 'countdown' ? 3 : 24,
    waitingForHost: screen === 'waiting', selectingTake: screen === 'loading',
    round: 2,
    practice: params.has('practice'), streamerName: 'TestCaster',
    participantNames: Object.fromEntries(names.map((name, i) => [`p${i}`, name])),
    participantColors: Object.fromEntries(names.map((name, i) => [name, TOY.palette[i % TOY.palette.length]])),
    game, mode: 'cvs', paused: false, participants: 24, capacity: 32, crowd: 0,
    connected: true, modifiers: [], wheel: [], votes: [], autopilot: true,
    safeZone: { x: 0, y: 0, w: 0, h: 0 }, showSafeZone: false,
    result: { winner: { kind: 'chat' }, champion: { userId: 'p0', displayName: names[0], reason: 'LAST STANDING' },
      mvps: [], highlights: [], perUser: Object.fromEntries(names.map((_, i) => [`p${i}`, { score: game.id === 'peg-fever' ? 2400 - i * 170 : game.id === 'blade-brawl' ? 40 - i * 3 : 52 - i * 3, tags: [`place:${i + 1}`] }])), replay: { seed: 1, inputs: [] } },
    show: {
      round: 2, phaseTime: 2, nextGameTitle: 'Multiplier Cascade',
      stages: [], stageIndex: 0, elapsed: 0, notifications: [],
    },
  };
  if (params.get('case') === 'team' && state.result) {
    state.mode = 'faction';
    state.result.winner = { kind: 'team', teamId: 'blue' };
    state.result.champion = undefined;
    const teams = ['blue', 'red', 'mint', 'gold', 'violet', 'orange'] as const;
    state.result.standings = teams.slice(0, Number(params.get('teams') ?? 4)).map((teamId, i) => ({
      teamId, score: 5 - Math.min(5, i), stat: `${5 - Math.min(5, i)} / 5 FINISHERS`
    }));
  }
  if ((screen === 'void' || params.get('case') === 'void') && state.result) {
    state.result.winner = { kind: 'void', reason: 'No players joined this round.' };
  }
  if (params.get('case') === 'streamer' && state.result) {
    state.result.winner = { kind: 'streamer' };
    state.result.champion = undefined;
  }
  if (state.phase === 'RESULT') state.timeLeft = 6;
  renderer.setIntermission(['RESULT'].includes(state.phase));
  const hud = new Hud(renderer.stage.hud);
  renderer.app.ticker.add(ticker => hud.update(state, Math.min(.1, ticker.deltaMS / 1000)));
  document.documentElement.dataset.preview = screen;
  addEventListener('beforeunload', () => renderer.destroy(), { once: true });
}
