export interface GameScore { bpm: number; root: number; bass: number[]; melody: number[] }

/** Original eight-step procedural scores. No recordings or external assets. */
export const GAME_SCORES: Record<string, GameScore> = {
  'blade-brawl': { bpm: 108, root: 55, bass: [0, 0, 3, 5], melody: [0, 7, 10, 7, 3, 5, 7, 12] },
  'pong-wars': { bpm: 116, root: 65.41, bass: [0, 5, 0, 7], melody: [0, 4, 7, 9, 7, 4, 2, 4] },
  'ring-escape': { bpm: 96, root: 73.42, bass: [0, 7, 5, 0], melody: [0, 2, 7, 9, 12, 9, 7, 2] },
  'marble-race': { bpm: 120, root: 61.74, bass: [0, 3, 7, 5], melody: [0, 3, 5, 7, 10, 7, 5, 3] },
  'multiplier-cascade': { bpm: 100, root: 65.41, bass: [0, 0, 5, 7], melody: [0, 7, 4, 9, 7, 12, 9, 4] },
  'light-cycles': { bpm: 124, root: 55, bass: [0, 0, 7, 3], melody: [0, 7, 12, 10, 7, 5, 3, 7] },
  'peg-fever': { bpm: 110, root: 65.41, bass: [0, 5, 7, 0], melody: [0, 4, 7, 12, 9, 7, 4, 14] },
  'hot-potato': { bpm: 126, root: 61.74, bass: [0, 0, 3, 7], melody: [0, 3, 7, 10, 12, 7, 3, 10] }
};

export class LayeredMusic {
  private layers: GainNode[];
  private gameId = '';
  private stage = -1;
  private beat = 0;
  private next = 0;
  private active = false;
  private voices = new Set<OscillatorNode>();
  private mixKey = '';

  constructor(private context: AudioContext, output: AudioNode) {
    this.layers = Array.from({ length: 3 }, () => {
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(output);
      return gain;
    });
  }

  update(gameId: string, stage: number, active: boolean, volume: number): void {
    const ctx = this.context;
    if (ctx.state !== 'running') return;
    const score = GAME_SCORES[gameId];
    if (!score) return;
    const octave = gameId === 'peg-fever' && stage === 2 ? 2 : 1;
    const root = score.root * octave;
    if (gameId !== this.gameId || active && !this.active) {
      this.gameId = gameId;
      this.beat = 0;
      this.next = ctx.currentTime + .04;
      this.stage = -1;
    }
    this.active = active;
    const mixKey = `${stage}:${active}:${volume}`;
    if (mixKey !== this.mixKey) {
      this.layers.forEach((layer, index) => layer.gain.setTargetAtTime(active && stage >= index ? volume : 0, ctx.currentTime, .18));
      this.mixKey = mixKey;
    }
    if (!active) return;
    if (stage !== this.stage) { this.stage = stage; this.sting(score, stage, octave); }
    const interval = 60 / score.bpm / 2;
    if (this.next < ctx.currentTime - interval) this.next = ctx.currentTime + .02;
    for (let scheduled = 0; this.next < ctx.currentTime + .1 && scheduled < 3; scheduled++) {
      const step = this.beat++;
      if (step % 2 === 0) this.note(root * 2 ** (score.bass[Math.floor(step / 2) % 4] / 12), this.next, .32, 0, .2, 'sine');
      if (stage >= 1) this.note(root * 4 * 2 ** (score.melody[step % 8] / 12), this.next, .16, 1, .11, 'triangle');
      if (stage >= 2) {
        this.note(step % 4 === 0 ? 48 : 1800 + (step % 3) * 170, this.next, .035, 2, step % 4 === 0 ? .13 : .025, 'triangle');
      }
      this.next += interval;
    }
  }

  private sting(score: GameScore, stage: number, octave = 1): void {
    for (let index = 0; index < 3; index++) {
      this.note(score.root * octave * 4 * 2 ** (([0, 7, 12][index] + stage * 2) / 12),
        this.context.currentTime + index * .09, .28, 0, .22, 'sine');
    }
  }

  private note(frequency: number, at: number, duration: number, layer: number, amplitude: number, wave: OscillatorType): void {
    if (this.voices.size >= 32) return;
    const voice = this.context.createOscillator();
    const envelope = this.context.createGain();
    voice.type = wave;
    voice.frequency.value = frequency;
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(amplitude, at + .006);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    voice.connect(envelope).connect(this.layers[layer]);
    this.voices.add(voice);
    voice.onended = () => { this.voices.delete(voice); voice.disconnect(); envelope.disconnect(); };
    voice.start(at);
    voice.stop(at + duration + .02);
  }

  destroy(): void {
    for (const voice of this.voices) { voice.onended = null; voice.stop(); voice.disconnect(); }
    this.voices.clear();
    for (const layer of this.layers) layer.disconnect();
  }
}
