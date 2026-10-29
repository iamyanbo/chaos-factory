export interface NeonRow {
  label: string;
  names: string[];
  color?: number;
}
export interface NeonBar {
  label: string;
  value: number;
  color: number;
  text?: string;
  flash?: boolean;
  side?: "left" | "right";
}
export interface NeonSideUpdate {
  arenaPercent?: number;
  bars?: NeonBar[];
  rows?: NeonRow[];
  feed?: string[];
  subtitle?: string;
  countLabel?: string;
}
