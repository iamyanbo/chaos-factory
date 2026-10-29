import type { HypeEvent } from './hype';
export type Mode = 'cvs' | 'faction';
export type TeamId = 'red' | 'blue' | 'mint' | 'gold' | 'violet' | 'orange';
export type Phase = 'ATTRACT' | 'INTRO' | 'LOBBY_BET' | 'LOCK_COUNTDOWN' | 'PLAY' | 'FINALE' | 'RESULT' | 'STANDINGS' | 'WHEEL' | 'CUP_RESULTS';
export interface Vec2 { x: number; y: number }
export interface Participant { userId: string; login: string; displayName: string; color: string; teamId?: TeamId; title?: string; golden?: boolean; level?: number; crowned?: boolean }
export interface RoundSetup {
  format?: 'boss' | 'ffa' | 'faction';
  mode: Mode; seed: number; gameId: string; difficulty: number; modifiers: string[];
  participants: Participant[]; teams?: TeamId[]; streamerName: string;
  competition?:'individual'|'team';
  crownUserId?: string;
  audience?: Participant[];
}
export type Winner = { kind: 'chat' } | { kind: 'streamer' } | { kind: 'team'; teamId: TeamId } | { kind: 'void'; reason: string };
export type GameEvent =
  | HypeEvent
  | { t: 'activity'; time: number; kind: 'hit' | 'parry' | 'flip' | 'checkpoint' | 'birth' }
  | { t: 'pass'; time: number; ring: number }
  | { t: 'elim'; victim: string; by?: string; cause: string }
  | { t: 'hit'; target: string; by?: string; dmg?: number }
  | { t: 'finish'; who: string; place: number }
  | { t: 'territory'; by: string; from: TeamId; to: TeamId }
  | { t: 'moment'; text: string; intensity: 1 | 2 | 3 }
  | { t: 'finale'; focus: Vec2 };
export interface StreamerInput { action: string; pressed: boolean; value?: number; seq: number }
export interface ChatGameInput { userId: string; verb: string; arg?: number | string; teamId?: TeamId }
export type LoggedInput = { tick: number; kind: 'chat'; input: ChatGameInput } | { tick: number; kind: 'streamer'; input: StreamerInput } | {tick:number;kind:'join';input:Participant};
export interface RoundResult {
  winnerLabel?: string;
  winnerColor?: number;
  bestTake?: {
    requestedSeed:number;selectedSeed:number;elapsedMs:number;budgetMs:number;timedOut:boolean;reason?:string;
    candidates:{seed:number;score:number;events:{duration:number;finished:boolean;leadChanges:number;finalCloseness:number;quietMax:number;passes:number;pops?:number;entrants?:number;jackpots?:number;nearMisses?:number;finalThirdJackpots?:number;finalThirdNearMisses?:number}}[];
  };
  winner: Winner; mvps: { userId: string; title: string; stat: string }[];
  champion?:{userId:string;displayName:string;reason:string};
  standings?:{teamId:TeamId;score:number;stat:string;remainingHp?:number}[];
  highlights: GameEvent[]; perUser: Record<string, { score: number; tags: string[] }>;
  replay: { seed: number; inputs: LoggedInput[]; setup?: RoundSetup };
}
export interface VerbSpec { verb: string; aliases?: string[]; args?: 'none' | 'int' | 'team'; scope: 'participant' | 'anyone'; cooldownMs: number; help: string }
export interface ControlSpec { action: string; key: string; label: string }
export interface CupState { round: number; rounds: number; chat: number; streamer: number; teams: Partial<Record<TeamId, number>>;
  standings?: import('./viewer-profile').CupStanding[]; championId?: string; grandFinal?: boolean }
export interface GameInfo { id: string; title: string; tagline: string; tier: number; modes: Mode[]; chatVerbs: VerbSpec[]; streamerControls: ControlSpec[] }
export interface UserStats { login: string; rounds: number; wins: number; score: number; mvps: number; crushes: number; survived: number; traitors: number; titles: string[]; factions: Partial<Record<TeamId, number>> }
