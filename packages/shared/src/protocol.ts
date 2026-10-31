import { z } from 'zod';
import { HYPE_KINDS, HYPE_STAMPS } from './hype';
import { cupRoundSchema, cupStandingSchema, viewerProfileSchema } from './profile-protocol';
export const teamSchema = z.enum(['red', 'blue', 'mint', 'gold', 'violet', 'orange']);
const id = z.string().min(1).max(100);
const gameId=z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const text = z.string().max(500);
const mode = z.enum(['cvs', 'faction']);
export const phaseSchema = z.enum(['ATTRACT', 'INTRO', 'LOBBY_BET', 'LOCK_COUNTDOWN', 'PLAY', 'FINALE', 'RESULT', 'STANDINGS', 'WHEEL', 'CUP_RESULTS']);
export const winnerSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('chat') }), z.object({ kind: z.literal('streamer') }), z.object({ kind: z.literal('team'), teamId: teamSchema }), z.object({ kind: z.literal('void'), reason: text })]);
export const streamerInputSchema = z.object({ action: id, pressed: z.boolean(), value: z.number().finite().optional(), seq: z.number().int().nonnegative() });
const chatInput = z.object({ userId: id, verb: id, arg: z.union([z.number().finite(), text]).optional(), teamId: teamSchema.optional() });
const participant=z.object({userId:id,login:id,displayName:text,color:z.string().max(20),teamId:teamSchema.optional(),title:text.optional(),golden:z.boolean().optional(),level:z.number().int().min(1).optional(),crowned:z.boolean().optional()});
const logged = z.union([z.object({ tick: z.number().int().nonnegative(), kind: z.literal('chat'), input: chatInput }), z.object({ tick: z.number().int().nonnegative(), kind: z.literal('streamer'), input: streamerInputSchema }),z.object({tick:z.number().int().nonnegative(),kind:z.literal('join'),input:participant})]);
export const setupSchema=z.object({format:z.enum(['boss','ffa','faction']).optional(),mode,seed:z.number().int(),gameId:id,difficulty:z.number().min(0).max(1),modifiers:z.array(id).max(12),streamerName:id,teams:z.array(teamSchema).min(2).max(6).optional(),participants:z.array(participant).max(500),competition:z.enum(['individual','team']).optional(),crownUserId:id.optional(),audience:z.array(participant).max(500).optional()});
const event = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hype'), kind: z.enum(HYPE_KINDS), time: z.number().finite().nonnegative(),
    x: z.number().finite(), y: z.number().finite(), count: z.number().int().positive().optional(),
    userId: id.optional(), name: text.optional(), color: z.number().int().min(0).max(0xffffff).optional(),
    key: text.optional(), text: z.enum(HYPE_STAMPS).optional() }),
  z.object({ t:z.literal('activity'), time:z.number().finite().nonnegative(), kind:z.enum(['hit','parry','flip','checkpoint','birth']) }),
  z.object({ t: z.literal('pass'), time: z.number().finite().nonnegative(), ring: z.number().int().min(1).max(6) }),
  z.object({ t: z.literal('elim'), victim: id, by: id.optional(), cause: text }),
  z.object({ t: z.literal('hit'), target: id, by: id.optional(), dmg: z.number().finite().optional() }),
  z.object({ t: z.literal('finish'), who: id, place: z.number().int() }),
  z.object({ t: z.literal('territory'), by: id, from: teamSchema, to: teamSchema }),
  z.object({ t: z.literal('moment'), text, intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.object({ t: z.literal('finale'), focus: z.object({ x: z.number().finite(), y: z.number().finite() }) })
]);
const takeEventsSchema = z.object({
  duration: z.number().finite().nonnegative(), finished: z.boolean(),
  leadChanges: z.number().int().nonnegative(), finalCloseness: z.number().min(0).max(1),
  quietMax: z.number().finite().nonnegative(), passes: z.number().int().nonnegative(),
  pops: z.number().int().nonnegative().optional(), entrants: z.number().int().nonnegative().optional(),
  jackpots: z.number().int().nonnegative().optional(), nearMisses: z.number().int().nonnegative().optional(),
  finalThirdJackpots: z.number().int().nonnegative().optional(), finalThirdNearMisses: z.number().int().nonnegative().optional()
});
const bestTakeSchema = z.object({
  requestedSeed: z.number().int(), selectedSeed: z.number().int(),
  elapsedMs: z.number().finite().nonnegative(), budgetMs: z.number().positive().max(6000),
  timedOut: z.boolean(), reason: z.string().optional(),
  candidates: z.array(z.object({ seed: z.number().int(), score: z.number().finite(), events: takeEventsSchema })).max(128)
});
export const resultSchema = z.object({ winnerLabel: text.optional(), winnerColor: z.number().int().min(0).max(0xffffff).optional(), bestTake: bestTakeSchema.optional(), winner: winnerSchema, champion:z.object({userId:id,displayName:text,reason:text}).optional(),standings:z.array(z.object({teamId:teamSchema,score:z.number().finite(),stat:text,remainingHp:z.number().finite().nonnegative().optional()})).min(2).max(6).optional(),mvps: z.array(z.object({ userId: id, title: text, stat: text })).max(3), highlights: z.array(event).max(1000), perUser: z.record(z.string(), z.object({ score: z.number().finite(), tags: z.array(id) })), replay: z.object({ seed: z.number().int(), inputs: z.array(logged).max(100000),setup:setupSchema.optional() }) });
export const createPredictionSchema = z.object({ title: z.string().min(1).max(45), outcomes: z.array(z.string().min(1).max(25)).min(2).max(10), windowSec: z.number().int().min(30).max(1800) });
export const predictionSchema = z.object({ id, status: z.enum(['ACTIVE', 'LOCKED', 'RESOLVED', 'CANCELED']), outcomes: z.array(z.object({ id, title: text, users: z.number().int().nonnegative(), points: z.number().nonnegative(), top: z.array(z.object({ userId: id, login: id, points: z.number().nonnegative() })) })), locksAt: z.number().optional(), winnerIndex: z.number().int().optional(), payouts: z.record(z.string(), z.number().nonnegative()).optional() });
export type Prediction = z.infer<typeof predictionSchema>;
const command = z.enum(['start', 'pause', 'resume', 'skip', 'next', 'endCup', 'setMode', 'setTeams', 'toggleWagers', 'forceVoid', 'queue', 'enableGame', 'audio', 'music', 'safeZone', 'transparent', 'autopilot', 'betWindow', 'setCapacity', 'setRoundStart', 'startRound']);
const cup = z.object({ round: z.number().int(), rounds: z.number().int(), chat: z.number(), streamer: z.number(), teams: z.record(z.string(), z.number()),
  standings: z.array(cupStandingSchema).max(500).optional(), championId: id.optional(), grandFinal: z.boolean().optional() });
const arg = z.union([z.string().max(200), z.number().finite(), z.boolean(), z.array(z.string().max(80)).max(30), z.record(z.string(), z.number().finite())]);
const schemas = [
  z.object({ type: z.literal('hello'), role: z.enum(['show', 'dashboard', 'controller']) }),
  z.object({ type: z.literal('chat'), userId: id, login: id, displayName: text, color: z.string().max(20), text, isMod: z.boolean(), isBroadcaster: z.boolean(), receivedAt: z.number() }),
  z.object({ type: z.literal('prediction.update'), ...predictionSchema.shape }),
  z.object({ type: z.literal('prediction.error'), op: id, code: id, message: text }),
  z.object({ type: z.literal('streamer.input'), ...streamerInputSchema.shape }),
  z.object({ type: z.literal('director.command'), cmd: command, arg: arg.optional() }),
  z.object({ type: z.literal('twitch.status'), mode: z.enum(['mock', 'live']), connected: z.boolean(), channel: id,
    canPredict: z.boolean(), lastError: text.optional(), configured: z.boolean().optional(),
    authenticated: z.boolean().optional(), eventSubConnected: z.boolean().optional(),
    authFlow: z.enum(['device', 'code']).optional(), lastJoinAt: z.number().nonnegative().optional(),
    broadcasterType: z.enum(['', 'affiliate', 'partner']).optional(),
    loginUrl: z.string().url().max(500).optional(), userId: id.optional(), displayName: text.optional() }),
  z.object({ type: z.literal('profiles.snapshot'), users: z.record(z.string(), viewerProfileSchema), crownUserId: id.optional(), lastWinners: z.record(z.string(), text).optional() }),
  z.object({ type: z.literal('stats.snapshot'), users: z.record(z.string(), z.object({ login: id, rounds: z.number(), wins: z.number(), score: z.number(), mvps: z.number(), crushes: z.number(), survived: z.number(), traitors: z.number(), titles: z.array(text), factions: z.record(z.string(), z.number()) })), factions: z.record(z.string(), z.number()) }),
  z.object({ type: z.literal('prediction.create'), ...createPredictionSchema.shape, roundId: z.string().uuid().optional() }),
  z.object({ type: z.literal('prediction.lock'), roundId: z.string().uuid().optional() }),
  z.object({ type: z.literal('prediction.resolve'), outcomeIndex: z.number().int().min(0).max(9), roundId: z.string().uuid().optional() }),
  z.object({ type: z.literal('prediction.cancel'), reason: text, roundId: z.string().uuid().optional() }),
  z.object({ type: z.literal('round.record'), gameId, mode, result: resultSchema,roundId:z.string().uuid().optional(),cup:cupRoundSchema.optional() }),
  z.object({ type: z.literal('director.state'), musicEnabled: z.boolean().optional(), phase: phaseSchema, gameId: id, mode, timeLeft: z.number().finite(), roundStart: z.enum(['automatic', 'manual']).optional(), waitingForHost: z.boolean().optional(), preparingRound: z.boolean().optional(), cup, participants: z.number().int().optional(),capacity:z.number().int().min(1).max(500).optional(),capacities:z.record(z.string(),z.number().int().min(1).max(500)).optional(),waiting:z.number().int().nonnegative().optional(), difficulty: z.number().optional(), paused: z.boolean().optional(), verbs: z.array(text).optional(), controls: z.array(z.object({ action: id, key: text, label: text })).optional(), queue: z.array(id).optional(), enabledGames: z.array(id).max(64).optional(), format: z.enum(['boss', 'ffa', 'faction']).optional(), modifiers: z.array(id).optional(), roundSeed: z.number().optional(),teams:z.array(teamSchema).min(2).max(6).optional() }),
  z.object({ type: z.literal('mock.chat'), login: z.string().regex(/^[a-zA-Z0-9_]{1,25}$/), text }),
  z.object({ type: z.literal('mock.swarm'), viewers: z.number().int().min(0).max(500), activity: z.number().min(0).max(1), delayMs: z.tuple([z.number().min(0).max(15000), z.number().min(0).max(15000)]), personalities: z.record(z.string(), z.number().min(0).max(1)).optional() }),
  z.object({type:z.literal('mock.status'),viewers:z.number().int().min(0).max(500),activity:z.number().min(0).max(1),delayMs:z.tuple([z.number(),z.number()]),personalities:z.record(z.string(),z.number())}),
  z.object({ type: z.literal('server.log'), level: z.enum(['info', 'error']), message: text, at: z.number() }),
  z.object({ type: z.literal('ping'), at: z.number() }), z.object({ type: z.literal('pong'), at: z.number() })
] as const;
export const messageSchema = z.discriminatedUnion('type', schemas);
export type Message = z.infer<typeof messageSchema>;
export type ChatMessage = Extract<Message, { type: 'chat' }>;
export type DirectorState = Extract<Message, { type: 'director.state' }>;
