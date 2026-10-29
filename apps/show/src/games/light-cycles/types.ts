export interface Cycle {
  ordinal: number;
  column: number;
  row: number;
  direction: number;
  pendingTurn: boolean;
  alive: boolean;
  diedAt?: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  cells: number[];
  deathX?: number;
  deathY?: number;
  cleared: boolean;
}

export interface Crash {
  ordinal: number;
  by?: number;
  cause: 'trail' | 'wall' | 'head-on';
  x: number;
  y: number;
}

export interface ModelEvents {
  crashes: Crash[];
  turns: number[];
}
