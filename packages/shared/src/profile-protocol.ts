import { z } from 'zod';

const userId = z.string().min(1).max(100);
const displayName = z.string().min(1).max(100);
export const viewerProfileSchema = z.object({
  userId, login: userId, displayName,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  wins: z.number().int().nonnegative(), cupsWon: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(), level: z.number().int().min(1),
  title: z.string().max(100), gameWins: z.record(z.string(), z.number().int().nonnegative())
});
export const cupRoundSchema = z.object({
  cupId: z.string().uuid(), round: z.number().int().min(1).max(5), final: z.boolean(),
  championId: userId.optional(),
  awards: z.array(z.object({
    userId, login: userId, displayName, points: z.number().int().min(0).max(20),
    place: z.number().int().min(1).max(500), won: z.boolean(), reason: z.string().max(200)
  })).max(500)
});
export const cupStandingSchema = z.object({
  userId, displayName, color: z.string().regex(/^#[0-9a-f]{6}$/i),
  points: z.number().int().nonnegative(), wins: z.number().int().nonnegative(),
  rank: z.number().int().min(1), previousRank: z.number().int().min(1),
  level: z.number().int().min(1), title: z.string().max(100), crowned: z.boolean()
});
