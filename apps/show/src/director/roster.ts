import { newViewerProfile, TEAMS, type Participant } from '@chaos/shared';
import type { Director } from './director';

export function decorate(d: Director, member: Participant): Participant {
  const profile = d.profiles[member.userId] ?? newViewerProfile(member);
  return { ...member, color: profile.color, level: profile.level, title: profile.title,
    crowned: member.userId === d.cupShow.crownUserId };
}

export function roundRoster(d: Director): Participant[] {
  if (d.cup.round === 5 && !d.options.practice) {
    return d.finalists.map(id => d.participants.members.get(id)).filter((member): member is Participant => Boolean(member))
      .map(member => decorate(d, { ...member, teamId: undefined }));
  }
  if (d.game.spectator) return [];
  const members = d.participants.roster(d.capacityFor(), 0);
  return members.map(member => decorate(d, d.mode === 'faction' ? member : { ...member, teamId: undefined }));
}

export function audienceRoster(d: Director): Participant[] {
  if (!d.game.spectator) return roundRoster(d);
  return d.participants.ordered().slice(0, 500).map(member => decorate(d, member));
}

export function prepareLineup(d: Director): void {
  const available = [...d.enabled].filter(id => d.registry.has(id));
  const requested = d.queue.filter(id => available.includes(id));
  const shuffled = d.rng.shuffle(available);
  const first = [...new Set([...requested, ...shuffled])].slice(0, 4);
  while (first.length < 4) first.push(d.rng.pick(available.length ? available : ['blade-brawl']));
  d.queue = [...first, 'blade-brawl'];
}

export function chooseGame(d: Director): void {
  if (!d.options.practice && d.cup.round === 5) {
    d.queue = [];
    d.game = d.registry.get('blade-brawl')!;
    d.format = 'ffa';
    d.mode = 'cvs';
    d.competition = 'individual';
    d.finalists = d.cupShow.topEight();
    return;
  }
  const queued = d.queue.shift();
  const choices = d.games.filter(game => d.enabled.has(game.id));
  d.game = queued && d.registry.has(queued) ? d.registry.get(queued)! : d.rng.pick(choices.length ? choices : d.games);
  const preferred = d.modeOverride === 'auto' ? d.cup.round % 2 ? 'cvs' : 'faction' : d.modeOverride;
  d.format = preferred === 'faction' && d.game.formats?.includes('faction') ? 'faction'
    : preferred === 'cvs' && d.game.formats?.includes('boss') ? 'boss' : d.game.formats?.[0];
  d.mode = d.format === 'faction' ? 'faction' : 'cvs';
  d.competition = d.format === 'ffa' ? 'individual' : 'team';
}

export function predictionOptions(d: Director): { titles: string[]; users: string[] } {
  const roster = d.ctx?.setup.participants ?? [];
  if (d.format === 'ffa') {
    const final = d.cup.round === 5 && !d.options.practice;
    const supported = final && roster.length >= 2 && roster.length <= 8;
    return { titles: supported ? roster.map(user => user.login.slice(0, 25)) : [],
      users: supported ? roster.map(user => user.userId) : [] };
  }
  if (d.mode === 'cvs') return { titles: ['CHAT WINS', `${d.streamerName.toUpperCase().slice(0, 20)} WINS`], users: [] };
  const teams = d.game.predictionTeams ?? (d.game.spectator || d.game.audienceIndependent ? d.participants.teams
    : d.participants.teams.filter(team => roster.some(user => user.teamId === team)));
  return { titles: teams.map(team => d.game.teamNames?.[team] ?? TEAMS[team].name), users: teams };
}
