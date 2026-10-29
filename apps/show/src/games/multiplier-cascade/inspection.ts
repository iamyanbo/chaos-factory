import type { MultiplierCascade } from './cascade';
import { CAMERA_ZOOM, COURSE } from './course-layout';

export function cascadeInspection(game: MultiplierCascade, expired: number) {
  return {
    wave: game.wave,
    phase: game.phase,
    age: game.time - game.waveStart,
    seedsPerTeam: game.seedsPerTeam,
    cameraTop: game.camera.y - 540,
    cameraY: game.camera.y,
    cameraZoom: CAMERA_ZOOM,
    course: COURSE,
    contacts: game.contacts,
    machines: game.board.machinery.inspect(),
    banked: Object.fromEntries(game.scores),
    units: [...game.units].map(([id, unit]) => ({
      id, team: unit.marble.team, stage: unit.stage,
      root: unit.root, lineage: unit.lineage, handle: unit.marble.body.handle
    })),
    bankings: game.bankings,
    splits: game.splits,
    drops: game.drops,
    relay: game.relay?.inspect(),
    suddenDeath: game.relay?.sudden ?? false,
    stage: game.relay ? 2 : Math.min(1, Math.floor((game.camera.y - 540) / 1600)),
    stalls: game.stalls,
    expired
  };
}
