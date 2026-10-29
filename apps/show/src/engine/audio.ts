import { Howler } from 'howler';
import { Rng } from './rng';
import { LayeredMusic } from '../show-layer/music';
import { Soundtrack } from '../show-layer/soundtrack';
export type Sound = 'pop' | 'clack' | 'slam' | 'whoosh' | 'coin' | 'chime' | 'charge' | 'explosion' | 'heartbeat' | 'horn' | 'crash';
export class Audio {
  private ctx?: AudioContext; private voices = new Map<string, OscillatorNode[]>(); private rng = new Rng(918);
  private output?:GainNode;private recording?:MediaStreamAudioDestinationNode;
  private layered?: LayeredMusic;
  private soundtrack?: Soundtrack;
  private musicTap?: MediaStreamAudioDestinationNode;
  private musicBridge?: MediaStreamAudioSourceNode;
  private showTrack?: { gameId: string; stage: number; active: boolean };
  private clock=0;private phase='ATTRACT';private duckUntil=0;
  master = .5; music = .25; sfx = .6; announcer = .6; muted = false;
  musicEnabled = true;
  sfxEnabled = true;
  constructor(muted = false) { this.muted = muted; }
  async unlock(): Promise<void> {
    if (this.muted) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.output = this.ctx.createGain();
      this.output.connect(this.ctx.destination);
      this.layered = new LayeredMusic(this.ctx, this.output);
      this.soundtrack = new Soundtrack();
    }
    this.soundtrack?.unlock();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }
  setShowTrack(gameId: string, stage: number, active: boolean): void { this.showTrack = { gameId, stage, active }; }
  /** Mixes game effects and licensed music; no microphone or desktop audio. */
  async captureStream(): Promise<MediaStream> {
    await this.unlock();
    if (!this.ctx || !this.output) throw new Error('Enable game sound before recording');
    if (!this.recording) {
      this.recording = this.ctx.createMediaStreamDestination();
      this.output.connect(this.recording);
    }
    this.connectMusicCapture();
    return this.recording.stream;
  }

  private connectMusicCapture(): void {
    if (!this.ctx || !this.recording || this.musicBridge || !Howler.masterGain) return;
    this.musicTap = Howler.ctx.createMediaStreamDestination();
    Howler.masterGain.connect(this.musicTap);
    this.musicBridge = this.ctx.createMediaStreamSource(this.musicTap.stream);
    // This branch goes only to the recording, never back to the speakers.
    this.musicBridge.connect(this.recording);
  }

  get status() {
    return { musicEnabled: this.musicEnabled, sfxEnabled: this.sfxEnabled, master: this.master,
      muted: this.muted, blocked: this.ctx?.state === 'suspended' || Howler.ctx?.state === 'suspended',
      ...this.soundtrack?.status };
  }
  setVolume(volume: number): void { this.master = Math.max(0, Math.min(1, volume)); Howler.volume(this.master); }
  setPhase(phase:string):void{this.phase=phase;}
  /** Pure pentatonic motion instrument: no random pitch, heartbeat or music bed. */
  bounce(sequence: number, impactSpeed: number, octave = 0): void {
    const scale = [0, 2, 4, 7, 9];
    const note = sequence % 10;
    const semitone = scale[note % 5] + 12 * Math.floor(note / 5) + 12 * octave;
    const speedPitch = Math.min(1.35, 0.85 + impactSpeed / 1600);
    this.motionNote(261.63 * 2 ** (semitone / 12) * speedPitch, 0.22);
  }

  ringPass(depth: number, octave = 0): void {
    const scale = [0, 2, 4, 7, 9, 12];
    this.motionNote(523.25 * 2 ** ((scale[Math.max(0, Math.min(5, depth - 1))] + octave * 12) / 12), 0.32);
  }

  weaponHit(speed: number, damage: number, kill: boolean): void {
    const frequency = kill ? 110 : 220 + damage * 8 + Math.min(1000, speed) * 0.2;
    this.motionNote(frequency, kill ? 0.25 : 0.12, 'triangle');
  }

  parry(speed: number): void {
    const frequency = 1100 + Math.min(1200, speed) * 0.4;
    this.motionNote(frequency, 0.13, 'triangle');
    this.motionNote(frequency * 1.47, 0.08, 'sine');
  }

  hypeCombo(count: number): void {
    this.motionNote(220 * 2 ** (Math.min(24, count) / 12), .09, 'triangle');
  }

  hypePayoff(): void {
    this.play('explosion');
    for (const [index, note] of [0, 4, 7, 12, 16, 19].entries()) {
      this.motionNote(220 * 2 ** (note / 12), .3, 'triangle', index * .075);
    }
    this.duck();
  }

  private motionNote(frequency: number, duration: number, wave: OscillatorType = 'sine', delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || !this.sfxEnabled || ctx.state !== 'running') return;
    const voice = ctx.createOscillator();
    const gain = ctx.createGain();
    voice.type = wave;
    voice.frequency.value = frequency;
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(this.master * this.sfx * 0.10, start + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    voice.connect(gain).connect(this.output!);
    voice.onended = () => {
      voice.disconnect();
      gain.disconnect();
    };
    voice.start(start);
    voice.stop(start + duration + 0.01);
  }
  duck():void{this.duckUntil=this.clock+1.5;}
  update(dt: number): void {
    this.clock += dt;
    const track = this.showTrack;
    const enabled = this.musicEnabled && !this.muted;
    const volume = this.music * (this.clock < this.duckUntil ? .35 : 1);
    if (track) {
      this.soundtrack?.update(track.gameId, this.phase, track.active, enabled, volume);
      this.layered?.update(track.gameId, track.stage,
        track.active && enabled && Boolean(this.soundtrack?.failed), this.master * volume);
    }
    this.connectMusicCapture();
  }
  play(sound: Sound, note = 0): void {
    const ctx = this.ctx; if (!ctx || this.muted || !this.sfxEnabled || ctx.state !== 'running') return;
    const pitches: Record<Sound, number> = { pop: 390, clack: 170, slam: 85, whoosh: 260, coin: 740, chime: 520, charge: 150, explosion: 55, heartbeat: 65, horn: 130, crash: 75 };
    const duration = sound === 'charge' || sound === 'horn' ? .6 : sound === 'chime' || sound === 'crash' ? .4 : .18;
    const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = sound === 'horn' ? 'sawtooth' : ['slam', 'explosion', 'clack', 'crash'].includes(sound) ? 'triangle' : 'sine';
    const scale = [0, 2, 4, 7, 9]; const pitch = pitches[sound] * 2 ** ((scale[note % 5] + 12 * Math.floor(note / 5)) / 12) * this.rng.range(.92, 1.08);
    osc.frequency.setValueAtTime(pitch, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(Math.max(25, pitch * (sound === 'charge' ? 3 : .45)), ctx.currentTime + duration);
    gain.gain.setValueAtTime(this.master * this.sfx * .18 * this.rng.range(.9, 1.1), ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(this.output!); const list = this.voices.get(sound) ?? []; if (list.length >= 6) list.shift()?.stop(); list.push(osc); this.voices.set(sound, list);
    osc.onended = () => { const i = list.indexOf(osc); if (i >= 0) list.splice(i, 1); osc.disconnect(); gain.disconnect(); };
    osc.start(); osc.stop(ctx.currentTime + duration);
  }
  destroy(): void {
    this.layered?.destroy();
    this.soundtrack?.destroy();
    if (this.musicTap) {
      Howler.masterGain.disconnect(this.musicTap);
      for (const track of this.musicTap.stream.getTracks()) track.stop();
    }
    this.musicBridge?.disconnect();
    this.output?.disconnect();
    this.recording?.disconnect();
    void this.ctx?.close();
    this.musicTap = undefined;
    this.musicBridge = undefined;
    this.recording = undefined;
    this.output = undefined;
    this.ctx = undefined;
  }
}
