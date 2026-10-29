import type { RoundResult, Winner } from '@chaos/shared';
import type { GameContext } from '../contract';
import type { TakeEvents } from '../../kit/take-types';
import { BOMB_COLOR, BOSS_CHAT_THRESHOLD, MEGA_COLOR, SHORT_FUSE_BELOW, TWO_BOMBS_BELOW } from './config';
import type { Bomb, Potato } from './types';

export function makeResult(ctx: GameContext, marbles: Potato[], time: number,
  winner: Winner, reason: string, champion?: Potato): RoundResult {
  return {
    winner, champion: champion ? { userId: champion.id, displayName: champion.name, reason } : undefined,
    mvps: [], highlights: [],
    perUser: Object.fromEntries(ctx.setup.participants.map(owner => {
      const marble = marbles.find(actor => actor.id === owner.userId)!;
      const won = winner.kind === 'chat' && (ctx.setup.format === 'boss' || champion === marble);
      const place = 1 + marbles.filter(other => other !== marble
        && (other.alive && !marble.alive || !other.alive && !marble.alive
          && other.outAt! > marble.outAt!)).length;
      return [owner.userId, { score: Math.round((marble.outAt ?? time) * 100) / 100,
        tags: [`place:${place}`, `tags:${marble.tags}`,
          ...(marble.alive ? ['survived'] : []), ...(won ? ['win'] : [])] }];
    })),
    replay: { seed: ctx.setup.seed, inputs: [] }
  };
}

export function updateHud(ctx: GameContext, marbles: Potato[], bombs: Bomb[],
  boss: boolean, sudden: boolean, feed: string[]): void {
  if (ctx.headless) return;
  const living = marbles.filter(marble => marble.alive);
  const chats = living.filter(marble => !marble.isStreamer).length;
  const smallBoss = boss && ctx.setup.participants.length <= BOSS_CHAT_THRESHOLD;
  const stage = living.length < SHORT_FUSE_BELOW ? 'SHORT FUSES'
    : living.length < TWO_BOMBS_BELOW ? 'TWO BOMBS' : 'BOMB TAG';
  ctx.hud.setSide?.({ countLabel: `${living.length} LEFT`,
    subtitle: sudden ? 'SUDDEN DEATH / FUSES x3' : stage,
    bars: bombs.map(bomb => ({ label: marbles[bomb.holder].name,
      value: Math.max(0, bomb.remaining / bomb.duration),
      color: bomb.mega ? MEGA_COLOR : BOMB_COLOR,
      text: `${bomb.mega ? 'MEGA ' : ''}FUSE ${Math.max(0, bomb.remaining).toFixed(1)}s`, side: 'left' })),
    rows: [{ label: 'CLEAN TAGS', names: [...living].sort((a, b) => b.tags - a.tags || a.ordinal - b.ordinal)
      .slice(0, 5).map(marble => `${marble.name}: ${marble.tags}`) }],
    feed: [...(boss ? [smallBoss ? 'SMALL FIELD / LAST SURVIVOR WINS'
      : `CHAT: ELIMINATE BOSS BEFORE ${BOSS_CHAT_THRESHOLD} REMAIN`, `${chats} chatters remain`] : []),
      'Touch another ball to pass the bomb', ...feed.slice(-4)] });
}

/** Only anonymous motion and reaction telemetry enters the selector. */
export function scoreTake(events: TakeEvents): number {
  return 100 - Math.abs(events.duration - 100) * 1.4
    + Math.min(100, events.passes) * .5 + events.leadChanges * 4
    + events.finalCloseness * 20 - Math.max(0, events.quietMax - 8) * 4
    - (events.finished ? 0 : 400);
}
