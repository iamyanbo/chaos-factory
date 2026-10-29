import type { BaseGame } from '../kit/base-game';
import type { BestTakeResult } from '../kit/take-types';
import { Renderer } from '../engine/render';
import { initPhysics, RAPIER } from '../engine/physics';
import { FixedLoop } from '../engine/loop';
import { Camera } from '../engine/camera';
import { Audio } from '../engine/audio';
import { Input } from '../engine/input';
import { Fx } from '../kit/fx';
import { selectBestTake } from '../kit/best-take';
import { Hud } from '../hud/hud';
import { Client } from '../net/client';
import { Director } from '../director/director';
import { createContext } from '../engine/context';
import { runSandbox } from './sandbox';
import { PracticePanel } from './practice';
import { HypeView } from '../kit/hype/view';
import { ballStyle, configureBallStyle } from '../kit/theme/ball-style';
import { connectedStreamerName } from './streamer-identity';
import { musicButton, musicPreference, saveMusicPreference, updateMusicButton } from './music-control';

export async function show(host: HTMLElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  configureBallStyle(params.get('ball'));
  const practice = location.pathname.startsWith('/play') || params.has('practice');
  document.body.className = practice ? 'practice' : 'show';
  await initPhysics();
  if (params.has('sandbox')) {
    await runSandbox(host, params);
    return;
  }
  const panel = practice ? new PracticePanel(host, params) : undefined;
  const renderer = new Renderer();
  await renderer.init(panel?.stage ?? host, params.has('transparent'));
  const camera = new Camera(renderer.scene);
  const audio = new Audio(params.has('mute'));
  const fx = new Fx(renderer.stage.fx);
  const hud = new Hud(renderer.stage.hud, practice);
  const hype = new HypeView(renderer.stage, camera, audio);
  const net = practice ? undefined : new Client('show');
  const director = new Director({
    send: message => net?.send(message) ?? false,
    context: (def, setup, emit) => createContext(def, setup, {
      stage: renderer.gameLayers, camera, fx, audio, hud, emit
    }),
    chooseTake: params.get('take') === 'seed' ? undefined
      : (setup, signal) => selectBestTake(setup, { signal }),
    announce: (text, priority) => hud.announce(text, priority),
    toast: text => hud.toast(text),
    feed: text => hud.kill(text),
    reset: () => {
      camera.reset();
      fx.clear();
      hud.clear();
      hype.reset();
    }
  }, {
    practice, fast: params.has('fast'),
    skipCountdown: practice && (params.has('record') || params.has('paused')),
    seed: params.has('seed') ? Number(params.get('seed')) : crypto.getRandomValues(new Uint32Array(1))[0],
    game: params.get('game') ?? undefined
  });
  director.transparent = params.has('transparent');
  director.musicEnabled = !params.has('mute') && musicPreference();
  if (!practice) host.insertAdjacentHTML('beforeend', musicButton());
  const music = host.querySelector<HTMLButtonElement>('.music-toggle')!;
  updateMusicButton(music, director.musicEnabled);
  let musicWasBlocked = false;
  let audioWasBlocked = false;
  // The browser/Howler can resume during event capture, before the button handler.
  // Retain the displayed frame's state so that the first click enables playback.
  music.onpointerdown = () => { musicWasBlocked = audioWasBlocked; };
  music.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') musicWasBlocked = audioWasBlocked;
  };
  music.onclick = () => {
    if (director.musicEnabled && musicWasBlocked) {
      audio.muted = false;
      void audio.unlock();
      musicWasBlocked = false;
      return;
    }
    director.command({ type: 'director.command', cmd: 'music', arg: !director.musicEnabled });
    saveMusicPreference(director.musicEnabled);
  };
  const onPreference = (event: StorageEvent) => {
    if (event.key === 'chaos.music.enabled') director.musicEnabled = musicPreference();
  };
  addEventListener('storage', onPreference);
  let previousMusic = director.musicEnabled;
  audio.musicEnabled = director.musicEnabled;
  if (!params.has('mute')) void audio.unlock();
  if (practice) director.streamerName = await connectedStreamerName() ?? 'Streamer';
  if (practice) director.safeZone = { x: 0, y: 0, w: 0, h: 0 };
  const input = new Input(event => director.streamer(event));
  panel?.connect(director, input, renderer.app.canvas, enabled => {
    audio.sfxEnabled = enabled;
    if (enabled) audio.muted = false;
    if (enabled) void audio.unlock();
  });
  if (net) {
    let mockCupStarted = false;
    net.onMessage = message => {
      director.receive(message);
      if (message.type === 'mock.status' && !params.has('manual')
        && director.bridgeMode === 'mock' && !mockCupStarted) {
        mockCupStarted = true;
        director.start();
      }
    };
    net.onConnection = connected => {
      director.connection(connected);
      if (connected) {
        net.send({ type: 'prediction.cancel', reason: 'Show startup: refund interrupted round' });
        director.broadcast();
      } else if (net.lastError) {
        const error = document.createElement('aside');
        error.className = 'show-connection-error';
        error.setAttribute('role', 'alert');
        const message = document.createElement('p');
        message.textContent = net.lastError;
        const dashboard = document.createElement('a');
        dashboard.href = '/dashboard';
        dashboard.textContent = 'Open the dashboard to control the running show';
        error.append(message, dashboard);
        host.append(error);
      }
    };
  }
  let lastBackground = '';
  let fps = 60;
  let frames = 0;
  let frameTime = 0;
  const loop = new FixedLoop(dt => director.step(dt), (alpha, dt) => {
    renderer.setIntermission(['RESULT', 'STANDINGS', 'CUP_RESULTS'].includes(director.phase));
    const minimal = director.game.presentation === 'minimal';
    renderer.setArenaMask(minimal);
    if (minimal && director.game.camera !== 'scroll') camera.lockFrame();
    else if (minimal) {
      camera.setViewport({left:420,right:1500,top:0,bottom:1080,minZoom:director.game.cameraZoom??1});
      camera.reserve({x:0,y:0,w:0,h:0});
    }
    else camera.reserve(director.safeZone);
    director.render(alpha);
    camera.update(dt);
    fx.update(dt);
    hud.update(director.view(), dt);
    hype.setArena(director.game.id);
    hype.update(director.paused ? 0 : dt, director.ctx?.hype, ['PLAY', 'FINALE'].includes(director.phase),
      id => director.instance?.inspect?.().marbles.find(actor => actor.id === id));
  });
  // Live decisive slow motion uses the same fixed steps; no past frames are stored.
  fx.onHitStop = ms => {
    if ((director.game.hitStop || director.game.presentation !== 'minimal') && !params.has('fast')) loop.hitStop(ms);
  };
  addEventListener('pointerdown', () => void audio.unlock(), { once: true });
  addEventListener('keydown', () => void audio.unlock(), { once: true });
  const captureStream = async (fps = 60): Promise<MediaStream> => {
    const mix = await audio.captureStream();
    return new MediaStream([
      ...renderer.app.canvas.captureStream(fps).getVideoTracks(),
      ...mix.getAudioTracks()
    ]);
  };
  renderer.app.ticker.add(ticker => {
    const dt = Math.min(0.1, ticker.deltaMS / 1000);
    const minimal = director.game.presentation === 'minimal';
    const background = `${director.game.id}:${director.transparent}`;
    if (background !== lastBackground) {
      renderer.background(director.transparent, minimal, director.game.id);
      renderer.app.renderer.background.alpha = director.transparent ? 0 : 1;
      lastBackground = background;
    }
    director.frame(dt);
    input.controls = director.game.streamerControls;
    input.poll();
    panel?.update();
    audio.setVolume(director.volume);
    if (director.musicEnabled !== previousMusic) {
      previousMusic = director.musicEnabled;
      saveMusicPreference(previousMusic);
      if (previousMusic) {
        audio.muted = false;
        void audio.unlock();
      }
      updateMusicButton(music, previousMusic);
    }
    audio.musicEnabled = director.musicEnabled;
    audio.setPhase(director.phase);
    loop.paused = director.paused;
    loop.timeScale = params.has('fast') ? 1 : hype.timeScale;
    if (params.has('fast') && !params.has('capture') && director.phase === 'PLAY') {
      for (let step = 0; step < 24; step++) director.step(1 / 60);
    }
    loop.frame(dt);
    audio.setShowTrack(director.game.id, director.stages.index, director.phase === 'PLAY' && !director.paused);
    audio.update(dt);
    audioWasBlocked = audio.status.blocked;
    frames++;
    frameTime += dt;
    if (frameTime > 1) {
      fps = frames / frameTime;
      frames = 0;
      frameTime = 0;
    }
    window.__chaos = {
      ballStyle: ballStyle(),
      audio: audio.status,
      physicsVersion: RAPIER.version(), captureStream,
      instantReplay: { frames: 0, bytes: 0, playing: false, failures: 0 },
      cameraZoom: camera.displayZoom, expectedCameraZoom: director.game.cameraZoom??1, cameraTarget: { ...camera.target },
      hype: { slowing: hype.slowing, timeScale: loop.timeScale, events: { ...hype.counts }, callout: hype.currentCallout },
      dramaState: director.instance?.dramaState?.(),
      inspect: () => (director.instance as BaseGame).inspect(),
      bestTake: director.bestTake, selectingTake: director.takePending,
      practice, practiceRole: director.practiceRole, autopilot: director.autopilot,
      connected: director.connected,
      phase: director.phase, gameId: director.game.id, seed: director.roundSeed,
      participants: director.ctx?.setup.participants ?? [],
      result: director.result, results: director.results, predictions: director.predictions,
      show: director.view().show,
      lastStreamerInput: director.lastStreamerInput, paused: director.paused,
      mode: director.mode, fps, bodies: director.ctx?.physics.entities.size ?? 0,
      particles: fx.count, inputs: director.inputs,
      command: (cmd, arg) => director.command({
        type: 'director.command',
        cmd: cmd as Parameters<Director['command']>[0]['cmd'],
        arg: arg as Parameters<Director['command']>[0]['arg']
      })
    };
  });
  addEventListener('beforeunload', () => {
    input.destroy();
    removeEventListener('storage', onPreference);
    director.destroy();
    net?.destroy();
    audio.destroy();
    hype.destroy();
    renderer.destroy();
  });
}

declare global {
  interface Window {
    __chaos: {
      ballStyle: import('../kit/theme/ball-style').BallStyle;
      audio: Audio['status'];
      physicsVersion: string;
      captureStream: (fps?: number) => Promise<MediaStream>;
      instantReplay: { frames: number; bytes: number; playing: boolean; failures: number };
      cameraZoom: number;
      expectedCameraZoom: number;
      cameraTarget: { x: number; y: number };
      hype: { slowing: boolean; timeScale: number; events: Record<string, number>;
        callout?: { text: string; x: number; y: number; width: number; actor?: string; point: { x: number; y: number } } };
      dramaState?: import('../kit/drama-types').DramaState;
      inspect: () => ReturnType<BaseGame['inspect']>;
      bestTake?: BestTakeResult;
      selectingTake: boolean;
      practice: boolean;
      connected: boolean;
      practiceRole: string;
      autopilot: boolean;
      phase: string;
      gameId: string;
      seed: number;
      participants: unknown[];
      result?: unknown;
      results: unknown[];
      predictions: unknown[];
      show?: import('../show-layer/state').ShowState;
      lastStreamerInput?: unknown;
      paused: boolean;
      mode: string;
      fps: number;
      bodies: number;
      particles: number;
      inputs: unknown[];
      command: (cmd: string, arg?: unknown) => void;
    };
  }
}
