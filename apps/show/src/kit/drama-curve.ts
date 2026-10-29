/** Canonical docs/18 attrition target, shared by Directors and the report. */
export function targetAliveFraction(time:number,duration:number,entrants:number):number {
  if(!Number.isFinite(time)||!Number.isFinite(duration)||duration<=0||!Number.isFinite(entrants)||entrants<0)throw new RangeError('Invalid drama curve input');
  if(entrants===0)return 0;
  const u=Math.max(0,time/duration),base=Math.max(0,Math.min(1,1-u**1.6));
  let cap=1;
  if(u>=.65&&u<.8){const x=(u-.65)/.15,smooth=x*x*(3-2*x);cap=1+(3/entrants-1)*smooth;}
  else if(u>=.8&&u<=.9)cap=3/entrants;
  else if(u>.9)cap=(3-2*Math.min(1,(u-.9)/.1))/entrants;
  return Math.max(1/entrants,Math.min(base,cap));
}
export function targetAliveCount(time:number,duration:number,entrants:number):number{return entrants*targetAliveFraction(time,duration,entrants);}
