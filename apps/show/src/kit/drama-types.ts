/** Read-only telemetry. Never use audience/wager data or this sink to decide a winner. */
export type DramaKind='race'|'survival';
export interface DramaState {
  kind:DramaKind;
  /** Actor IDs match marble.id; higher is better. One unit is one ring/checkpoint. */
  progress:Record<string,number>;
}
export interface DramaPhysicalEvent {
  kind:'hazard-hit'|'near-miss'|'ring-pass';
  /** Fixed simulation seconds at the physical contact/crossing, not a director tick. */
  time:number;
  actorId:string;
  /** Stable physical hazard identity; required for a near-miss to qualify. */
  hazardId?:string;
  /** Surface gap in world pixels. <=0.5r is an approach; >r rearms hysteresis without counting an event. */
  clearance?:number;
  /** Actor's physical radius in the same units as clearance. */
  radius?:number;
}
export type DramaSink=(event:DramaPhysicalEvent)=>void;
