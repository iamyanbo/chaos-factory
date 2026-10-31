import { parseChat, TEAMS } from '@chaos/shared';
import type { Director, PracticeSetup } from './director';
import { PRACTICE_USER } from './director';
import { Participants } from './participants';
import { handleChat } from './network';

export function configurePractice(d: Director, setup: PracticeSetup): void {
  const game = d.registry.get(setup.gameId);
  if (!d.options.practice || !game) return;
  d.search.cancel(d);
  d.game = game;
  d.format = setup.format && game.formats?.includes(setup.format) ? setup.format : game.formats?.[0];
  d.mode = d.format === 'faction' ? 'faction' : 'cvs';
  d.competition = d.format === 'ffa' ? 'individual' : 'team';
  d.roundSeed = Number.isFinite(setup.seed) ? Math.trunc(setup.seed) >>> 0 : 1;
  if (setup.capacity !== undefined) d.setCapacity(game.id, setup.capacity);
  d.practiceRole = 'chatter';
  d.clock = 0;
  d.results = [];
  d.round = 1;
  d.participants = new Participants();
  d.participants.reset(Math.max(2, Math.min(game.maxTeams ?? 6, Math.floor(setup.teamCount ?? 4))));
  const team = d.participants.teams.includes(setup.team) ? setup.team : 'red';
  if (!game.spectator) {
    if (d.practiceJoined) d.participants.join({ userId: PRACTICE_USER, login: 'you', displayName: 'YOU', color: TEAMS[team].color }, 0);
    const human = Number(d.participants.members.has(PRACTICE_USER));
    const bots = Number.isFinite(setup.bots) ? Math.floor(setup.bots) : game.defaultBots ?? 24;
    d.participants.fill(Math.max(0, Math.min(d.capacityFor() - human, bots)), 0);
  }
  d.paused = false;
  d.lastStreamerInput = undefined;
  d.enter('INTRO');
  d.prepareTake();
}

export function practiceChat(d: Director, text: string): void {
  if (!d.options.practice || d.game.spectator || parseChat(text)?.kind !== 'join') return;
  d.practiceJoined = true;
  handleChat(d, { type: 'chat', userId: PRACTICE_USER, login: 'you', displayName: 'YOU',
    color: '#4db4ff', text: '!join', isMod: false, isBroadcaster: false, receivedAt: d.clock * 1000 });
}
