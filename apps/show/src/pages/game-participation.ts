import type { GameDefinition } from '../games/contract';
import type { DirectorState } from '@chaos/shared';

export function participationLabel(game: GameDefinition): string {
  if (game.spectator) return 'Team event';
  if (game.participantNoun === 'supporter') return 'Faction supporters';
  const formats = game.formats ?? [];
  if (formats.includes('ffa') && formats.includes('faction')) return 'Individual / teams';
  if (formats.includes('faction')) return 'Faction War';
  if (formats.includes('boss') && !formats.includes('ffa')) return 'Chat vs Streamer';
  return 'Individual';
}

export function currentParticipation(game: GameDefinition | undefined, state: DirectorState): string {
  if (game?.spectator) return 'Team event';
  if (game?.participantNoun === 'supporter') return 'Faction supporters';
  if (state.format === 'boss') return 'Chat vs Streamer';
  if (state.format === 'faction' || state.mode === 'faction') return 'Faction War';
  return state.cup.grandFinal ? 'Grand Final' : 'Individual';
}
