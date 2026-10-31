import type { VideoSegment } from './video-plan';

declare global { interface Window { drawVideoDialogue: typeof drawVideoDialogue } }

/** Self-contained so the same renderer can run in the headless browser. */
export function drawVideoDialogue(ctx: CanvasRenderingContext2D, segment: VideoSegment, time: number): void {
  const ink = '#1b1b3a';
  const pink = '#ff4f7b';
  const yellow = '#ffde3b';
  function lettering(text: string, x: number, y: number, size: number) {
    ctx.font = `${size}px Lilita`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 12;
    ctx.strokeText(text, x + 5, y + 7);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 6;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = yellow;
    ctx.fillText(text, x, y);
  }
  if (segment.sectionIntro && time > .12 && time < 1.85) {
    const age = time - .12;
    const pop = 1 - Math.exp(-age * 18) * Math.cos(age * 17);
    ctx.save();
    ctx.globalAlpha = Math.min(1, age * 10, (1.85 - time) * 6);
    ctx.translate(960, 430);
    ctx.scale(pop, pop);
    ctx.rotate(-.045);
    lettering(segment.sectionIntro, 0, 0, 134);
    ctx.restore();
  }
  if (segment.source !== 'setup') return;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.roundRect(35, 48, 320, 72, 20);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = '32px Lilita';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('QUEUE GAMES', 195, 84);
  ctx.restore();
  for (const caption of segment.captions ?? []) {
    if (time < caption.from || time > caption.to) continue;
    const age = time - caption.from;
    const remaining = caption.to - time;
    const enter = Math.min(1, age / .18);
    ctx.save();
    ctx.globalAlpha = Math.min(1, enter, remaining / .12);
    ctx.translate(300, 875 + (1 - enter) ** 3 * 24);
    ctx.fillStyle = '#1b1b3a33';
    ctx.beginPath();
    ctx.roundRect(7, 9, 1320, 158, 26);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(0, 0, 1320, 158, 26);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pink;
    ctx.beginPath();
    ctx.arc(75, 75, 39, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '48px Lilita';
    ctx.fillText(String(caption.step), 75, 75);
    ctx.textAlign = 'left';
    ctx.fillStyle = pink;
    ctx.font = '26px Lilita';
    ctx.fillText(caption.label, 145, 39);
    ctx.fillStyle = ink;
    ctx.font = '44px Fredoka';
    ctx.fillText(caption.text, 145, 89);
    for (let step = 1; step <= 3; step++) {
      ctx.fillStyle = step <= caption.step ? yellow : '#e8edff';
      ctx.fillRect(145 + (step - 1) * 68, 126, 56, 6);
    }
    ctx.restore();
  }
}
