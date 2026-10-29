import { cssColor, TOY } from './toy';

/** DOM surfaces consume the same values as Pixi, including dashboard cards. */
export function installToyCss(): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(TOY.color)) {
    root.style.setProperty(`--toy-${key}`, cssColor(value));
  }
  for (const [key, value] of Object.entries(TOY.card)) {
    root.style.setProperty(`--toy-card-${key}`, key === 'shadowAlpha' ? String(value) : `${value}px`);
  }
  root.style.setProperty('--toy-display', `"${TOY.font.display}"`);
  root.style.setProperty('--toy-body', `"${TOY.font.body}"`);
  for (const [key, value] of Object.entries(TOY.type)) root.style.setProperty(`--toy-type-${key}`, `${value}px`);
  root.style.setProperty('--toy-dot', `rgba(255,255,255,${TOY.pattern.alpha})`);
  root.style.setProperty('--toy-grid', `${TOY.pattern.grid}px`);
  root.style.setProperty('--toy-dot-radius', `${TOY.pattern.radius}px`);
  root.style.setProperty('--toy-shadow', `color-mix(in srgb, ${cssColor(TOY.color.ink)} 20%, transparent)`);
}
