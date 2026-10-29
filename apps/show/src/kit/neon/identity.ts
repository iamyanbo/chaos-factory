import { stableViewerColor, type Participant } from '@chaos/shared';

/** A viewer keeps this hue in every solo game; faction paint still uses teams. */
export function viewerColor(viewer: Participant): number {
  const color = viewer.level && /^#[0-9a-f]{6}$/i.test(viewer.color) ? viewer.color : stableViewerColor(viewer.userId);
  return Number.parseInt(color.slice(1), 16);
}
