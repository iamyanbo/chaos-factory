import type { ChatGameInput, GameEvent, Mode, RoundResult, RoundSetup, StreamerInput, Vec2, VerbSpec, ControlSpec, Rng,Participant } from '@chaos/shared';
import type { PhysicsWorld } from '../engine/physics';
import type { Layers } from '../engine/render';
import type { Camera } from '../engine/camera';
import type { Fx } from '../kit/fx';
import type { Audio } from '../engine/audio';
import type { Kit } from '../kit/kit';
import type { DramaSink,DramaState } from '../kit/drama-types';
import type { TakeEvents } from '../kit/take-types';
import type { NeonSideUpdate } from '../kit/neon/hud';
import type { HypeSink } from '../kit/hype';
export type { DramaKind,DramaState,DramaPhysicalEvent,DramaSink } from '../kit/drama-types';
export interface GameHud {
  setSide?(state: NeonSideUpdate): void;
  setMetric(title: string, value: string): void;
  setTeams(values: { team: string; value: number }[]): void;
  announce(text: string, intensity?: number): void;
  feedback?(userId: string, verb: string, team?: string): void;
  setLadder?(rows: { label: string; names: string[] }[]): void;
  scoreTarget?(displayName: string): Vec2 | undefined;
}
export interface GameContext {
  setup: RoundSetup; rng: Rng; physics: PhysicsWorld; stage: Layers;
  camera: Camera; fx: Fx; audio: Audio; hud: GameHud; kit: Kit;
  hype: HypeSink;
  headless: boolean; emit(e: GameEvent): void;
  drama?:DramaSink;
}
export type GameStatus = 'playing' | { finale: { focus: Vec2; reason: string } } | { done: RoundResult };
export interface GameInstance {
  /** Starts visible physical overtime. This must be idempotent, never a clock verdict. */
  suddenDeath?(): void;
  inspect?(): GameInspection;
  start(): void; step(dt: number): void; render(alpha: number): void;
  onChat(input: ChatGameInput): void; onStreamer(input: StreamerInput): void;
  status(): GameStatus; destroy(): void;
  onJoin?(participant:Participant):boolean;
  dramaState?():DramaState;
  takeState?():number[];
}
export interface GameInspection {
  time: number;
  keys: string[];
  details?: Record<string, unknown>;
  marbles: { id: string; x: number; y: number; alive: boolean;
    finished?: boolean; dormant?: boolean; isStreamer?: boolean }[];
}
export interface GameDefinition {
  teamNames?: Partial<Record<import('@chaos/shared').TeamId, string>>;
  takeActivities?: ('hit' | 'parry' | 'flip' | 'checkpoint' | 'birth')[];
  ending?: 'natural' | 'timed';
  formats?:('boss'|'ffa'|'faction')[];
  camera?:'fixed'|'scroll';
  cameraZoom?:number;
  maxTeams?:number;
  hitStop?:boolean;
  defaultBots?:number;
  audienceIndependent?:boolean;
  id: string; title: string; tagline: string; archetype: 'boss' | 'runner' | 'faction' | 'luck'; tier: 1 | 2 | 3;
  modes: Mode[]; durationSec: { target: number; hardCap: number }; maxBodies: number; maxParticipants: number;
  chatVerbs: VerbSpec[]; streamerControls: ControlSpec[]; supportsModifiers: string[];
  joinOnly?:boolean;
  spectator?:boolean;
  experimental?:'prototype'|'rejected';
  presentation?:'drama'|'minimal';
  machineBallsPerTeam?:number;
  participantNoun?:string;
  competition?:'team'|'individual'|'score';
  scoreDisplay?:{label:string;unit:string;reason:string};
  create(ctx: GameContext): GameInstance;
  scoreTake?(events:TakeEvents):number;
}
export function isAutomatic(game:{joinOnly?:boolean;spectator?:boolean}):boolean{return Boolean(game.joinOnly||game.spectator);}
export function isDefaultGame(game:{joinOnly?:boolean;spectator?:boolean;experimental?:'prototype'|'rejected'}):boolean{return isAutomatic(game)&&!game.experimental;}
