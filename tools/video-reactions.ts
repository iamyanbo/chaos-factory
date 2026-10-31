import type { VideoSegment } from './video-plan';

export interface VideoReaction {
  at: number; seconds: number; emote: string; x: number; y: number; size: number; angle: number;
}
declare global { interface Window { drawVideoReactions: typeof drawVideoReactions } }

/** Separate, staggered reactions in spare space, never paired with caption text. */
export function eventReactions(segment: VideoSegment): VideoReaction[] {
  const reactions: VideoReaction[] = [];
  for (const cue of segment.cues ?? []) {
    const names = cue.kind === 'burst' ? ['NotLikeThis', 'LUL', 'Kappa']
      : cue.kind === 'score' ? ['PogChamp', 'PogChamp', 'LUL'] : ['PogChamp', 'SeemsGood', 'Kappa'];
    const positions = [[575, 190], [1730, 760], [1340, 790]];
    if (!segment.chapter || cue.at > 7.5) positions[2] = [220, 805];
    names.forEach((emote, index) => reactions.push({ at: cue.at + .06 + index * .23, seconds: .95,
      emote, x: positions[index][0], y: positions[index][1], size: index === 0 ? 122 : 108,
      angle: index === 0 ? -.13 : index === 1 ? .12 : -.08 }));
  }
  if (segment.gameId === 'multiplier-cascade' && segment.chapter) {
    reactions.push({ at: 6.8, seconds: 1.1, emote: 'PogChamp', x: 1730, y: 720, size: 124, angle: .1 });
    reactions.push({ at: 7.2, seconds: 1, emote: 'SeemsGood', x: 575, y: 200, size: 106, angle: -.13 });
  }
  if (segment.celebrate) {
    reactions.push({ at: .6, seconds: 1.2, emote: 'PogChamp', x: 1750, y: 780, size: 130, angle: .1 });
    reactions.push({ at: .95, seconds: 1.15, emote: 'LUL', x: 220, y: 420, size: 110, angle: -.1 });
    reactions.push({ at: 1.3, seconds: 1.1, emote: 'SeemsGood', x: 1720, y: 930, size: 112, angle: .1 });
  }
  return reactions.filter(row => row.at + row.seconds < segment.seconds - .1);
}

/** Raw transparent Twitch images: no badge boxes, captions or fake usernames. */
export function drawVideoReactions(ctx: CanvasRenderingContext2D, segment: VideoSegment, time: number): void {
  for (const reaction of segment.reactions ?? []) {
    const age = time - reaction.at;
    if (age < 0 || age > reaction.seconds) continue;
    const progress = age / reaction.seconds;
    const pop = 1 - Math.exp(-age * 21) * Math.cos(age * 18);
    const image = window.videoEmoteImages[reaction.emote];
    if (!image) throw new Error(`Missing Twitch reaction: ${reaction.emote}`);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, age / .09, (reaction.seconds - age) / .2));
    ctx.translate(reaction.x, reaction.y - Math.sin(progress * Math.PI) * 16);
    ctx.rotate(reaction.angle);
    ctx.scale(pop, pop);
    ctx.shadowColor = '#1b1b3a55';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(image, -reaction.size / 2, -reaction.size / 2, reaction.size, reaction.size);
    ctx.restore();
  }
}
