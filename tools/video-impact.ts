import type { VideoSegment } from './video-plan';

export const IMPACT_CAPTION_LAYOUT = {
  x: 960, y: 510, maxTextWidth: 520, stickerSize: 112, stickerGap: 32
} as const;
type CaptionLayout = typeof IMPACT_CAPTION_LAYOUT;
declare global { interface Window { drawVideoImpact: typeof drawVideoImpact } }

/** Centered editorial captions and authentic Twitch stickers, never a chat feed. */
export function drawVideoImpact(ctx: CanvasRenderingContext2D, segment: VideoSegment,
  time: number, layout: CaptionLayout): void {
  const ink = '#1b1b3a';
  for (const cue of segment.cues ?? []) {
    const age = time - cue.at;
    if (age < 0 || age > cue.seconds) continue;
    const alpha = Math.max(0, Math.min(1, age / .09, (cue.seconds - age) / .16));
    const pop = 1 - Math.exp(-age * 24) * Math.cos(age * 18);
    const baseSize = cue.kind === 'score' ? 132 : 116;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${baseSize}px Lilita`;
    const size = baseSize * Math.min(1, layout.maxTextWidth / ctx.measureText(cue.title).width);
    ctx.font = `${size}px Lilita`;
    const width = ctx.measureText(cue.title).width;
    ctx.translate(layout.x, layout.y);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 13;
    ctx.strokeText(cue.title, 5, 7);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 6;
    ctx.strokeText(cue.title, 0, 0);
    ctx.fillStyle = '#ffde3b';
    ctx.fillText(cue.title, 0, 0);
    if (cue.detail) {
      ctx.font = '34px Fredoka';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 7;
      ctx.strokeText(cue.detail, 0, 89);
      ctx.fillStyle = 'white';
      ctx.fillText(cue.detail, 0, 89);
    }
    const names = cue.kind === 'burst' ? ['TwitchLit', 'PartyHat'] : ['SeemsGood', 'PartyHat'];
    names.forEach((name, index) => {
      const image = window.videoEmoteImages[name];
      if (!image) throw new Error(`Missing authentic Twitch emote: ${name}`);
      const direction = index === 0 ? -1 : 1;
      const x = direction * (width / 2 + layout.stickerSize / 2 + layout.stickerGap);
      ctx.save();
      ctx.translate(x, -5);
      ctx.rotate(direction * .09);
      const half = layout.stickerSize / 2;
      ctx.fillStyle = 'white';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-half - 9, -half - 9, layout.stickerSize + 18, layout.stickerSize + 18, 22);
      ctx.fill();
      ctx.stroke();
      ctx.drawImage(image, -half, -half, layout.stickerSize, layout.stickerSize);
      ctx.restore();
    });
    ctx.restore();
  }
}
