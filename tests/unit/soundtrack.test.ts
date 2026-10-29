import { beforeEach, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({ loops: [] as {
  src: string[]; playing: boolean; plays: number; unloaded: boolean; failed: () => void;
}[] }));

vi.mock('howler', () => ({
  Howler: { ctx: undefined },
  Howl: class {
    private record;
    constructor(options: { src: string[]; onloaderror: () => void }) {
      this.record = { src: options.src, playing: false, plays: 0, unloaded: false,
        failed: options.onloaderror };
      fake.loops.push(this.record);
    }
    state() { return 'loaded'; }
    playing() { return this.record.playing; }
    play() { this.record.plays++; this.record.playing = true; }
    pause() { this.record.playing = false; }
    volume() {}
    unload() { this.record.unloaded = true; this.record.playing = false; }
  }
}));

import { GAME_MUSIC, Soundtrack } from '../../apps/show/src/show-layer/soundtrack';

beforeEach(() => { fake.loops.length = 0; });

test('pause, mute, and phase changes never stack loops or restart a retained song', () => {
  const music = new Soundtrack();
  const update = (phase: string, active = true, enabled = true) =>
    music.update('multiplier-cascade', phase, active, enabled, .25);
  update('PLAY', true, false);
  expect(fake.loops).toHaveLength(0);
  for (let frame = 0; frame < 600; frame++) update('PLAY');
  expect(fake.loops).toHaveLength(1);
  expect(fake.loops[0].plays).toBe(1);
  expect(music.status.playing).toBe(true);
  // Captures and user gestures may call unlock again on an already audible bed.
  music.unlock();
  update('PLAY');
  expect(fake.loops[0].plays).toBe(1);
  update('PLAY', false);
  expect(music.status.playing).toBe(false);
  update('PLAY');
  expect(fake.loops[0].plays).toBe(2);
  update('PLAY', true, false);
  expect(music.status.playing).toBe(false);
  update('PLAY');
  expect(fake.loops).toHaveLength(1);
  update('STANDINGS');
  expect(fake.loops[0].unloaded).toBe(true);
  expect(fake.loops.filter(loop => loop.playing)).toHaveLength(1);
  expect(music.status.track).toBe('menu');
  music.destroy();
  expect(fake.loops.every(loop => loop.unloaded)).toBe(true);
});

test('a missing music asset stops retrying until the next song; all eight games have beds', () => {
  const music = new Soundtrack();
  music.update('blade-brawl', 'PLAY', true, true, .25);
  fake.loops[0].failed();
  for (let frame = 0; frame < 600; frame++) music.update('blade-brawl', 'PLAY', true, true, .25);
  expect(music.failed).toBe(true);
  expect(fake.loops).toHaveLength(1);
  music.update('blade-brawl', 'STANDINGS', false, true, .25);
  expect(music.failed).toBe(false);
  expect(Object.keys(GAME_MUSIC)).toHaveLength(8);
  music.destroy();
});
