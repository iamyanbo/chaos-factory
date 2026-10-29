import './music-control.css';

const PREFERENCE = 'chaos.music.enabled';
const NOTE = '<path d="M9 18V6l11-2v12M9 9l11-2"/><ellipse cx="5.5" cy="18" rx="3.5" ry="3"/><ellipse cx="16.5" cy="16" rx="3.5" ry="3"/>';

export function musicPreference(): boolean {
  try { return localStorage.getItem(PREFERENCE) !== 'false'; }
  catch { return true; }
}

export function saveMusicPreference(enabled: boolean): void {
  try { localStorage.setItem(PREFERENCE, String(enabled)); }
  catch { /* Private browser storage can be unavailable; the button still works. */ }
}

export function musicButton(): string {
  return `<button type="button" class="music-toggle" aria-label="Mute music" aria-pressed="true" title="Mute music">
    <svg viewBox="0 0 24 24" aria-hidden="true">${NOTE}<path class="music-slash" d="M3 3l18 18"/></svg>
  </button>`;
}

export function updateMusicButton(button: HTMLButtonElement, enabled: boolean): void {
  const label = enabled ? 'Mute music' : 'Enable music';
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(enabled));
  button.title = label;
}
