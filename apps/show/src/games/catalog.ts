import { predictionTitle, type Mode } from '@chaos/shared';
import type { GameContext, GameDefinition, GameInstance } from './contract';

export const JOIN_LIMITS: Readonly<Record<string, number>> = {
  'blade-brawl': 32,
  'pong-wars': 256,
  'ring-escape': 64,
  'marble-race': 48,
  'light-cycles': 32,
  'peg-fever': 64,
  'hot-potato': 64
};
interface Spec {
  ending?: 'natural' | 'timed';
  title: string;
  tagline: string;
  archetype: GameDefinition['archetype'];
  tier: 1 | 2 | 3;
  modes: Mode[];
  duration: number;
  verbs: string[];
  controls: string[];
  joinOnly?: boolean;
  spectator?: boolean;
  experimental?: 'prototype' | 'rejected';
  participantNoun?: string;
  competition?: 'team' | 'individual' | 'score';
  scoreDisplay?: GameDefinition['scoreDisplay'];
}
export const SPECS: Record<string, Spec> = {
  'blade-brawl': {
    title: 'BLADE BRAWL', tagline: 'Spinning weapons. Last fighter standing.',
    archetype: 'boss', tier: 1, modes: ['cvs', 'faction'], duration: 90,
    verbs: [], controls: [], joinOnly: true, competition: 'team', participantNoun: 'fighter'
  },
  'pong-wars': {
    ending: 'timed',
    title: 'PONG WARS', tagline: 'Bounce, flip territory, take the grid.',
    archetype: 'faction', tier: 1, modes: ['faction'], duration: 90,
    verbs: [], controls: [], joinOnly: true, competition: 'team', participantNoun: 'viewer'
  },
  'ring-escape': {
    title: 'RING RUN+', tagline: 'Escape, grow, survive the red arcs.',
    archetype: 'luck', tier: 1, modes: ['cvs', 'faction'], duration: 90,
    verbs: [], controls: [], joinOnly: true, competition: 'individual', participantNoun: 'marble'
  },
  'marble-race': {
    title: 'MARBLE RACE', tagline: 'One gravity course. Every marble has a chance.',
    archetype: 'runner', tier: 1, modes: ['cvs', 'faction'], duration: 105,
    verbs: [], controls: [], joinOnly: true, competition: 'individual', participantNoun: 'marble'
  },
  'light-cycles': {
    title: 'LIGHT CYCLES', tagline: 'Leave a solid trail. Find space. Last cycle alive wins.',
    archetype: 'luck', tier: 1, modes: ['cvs'], duration: 105,
    verbs: [], controls: [], joinOnly: true, competition: 'individual', participantNoun: 'cycle'
  },
  'multiplier-cascade': {
    ending: 'natural',
    title: 'MULTIPLIER CASCADE', tagline: 'Multiply your supply. First to five finishers wins.',
    archetype: 'faction', tier: 2, modes: ['faction'], duration: 120,
    verbs: [], controls: [], spectator: true, competition: 'score'
  }
};

export function defineGame(id: string, create: (ctx: GameContext) => GameInstance): GameDefinition {
  const spec = SPECS[id];
  if (!spec) throw new Error(`Unknown game metadata: ${id}`);
  return {
    id, ...spec, chatVerbs: [], streamerControls: [],
    durationSec: {target: spec.duration, hardCap: 150},
    maxBodies: 200, maxParticipants: JOIN_LIMITS[id] ?? 0, supportsModifiers: [],
    predictionTitle: setup => predictionTitle(spec.title, setup.mode), create
  };
}
export function defineAutomatic(id: string, create: (ctx: GameContext) => GameInstance,
  maxParticipants: number): GameDefinition {
  if (JOIN_LIMITS[id] !== maxParticipants) throw new Error(`Participant limit metadata mismatch: ${id}`);
  return {...defineGame(id, create), maxParticipants};
}
export function defineEvent(id: string, create: (ctx: GameContext) => GameInstance): GameDefinition {
  if (!SPECS[id]?.spectator) throw new Error(`Not a spectator event: ${id}`);
  return {...defineGame(id, create), maxParticipants: 0};
}
