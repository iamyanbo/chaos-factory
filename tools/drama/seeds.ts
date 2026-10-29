/** Fairness never shrinks with --runs and is never renormalized to a selected seed range. */
export function dramaSeeds(runs:number,start:number,faction:boolean):{measured:number[];fairness:number[];unique:number[]} {
  const measured=Array.from({length:runs},(_,i)=>start+i),fairness=faction?Array.from({length:300},(_,i)=>i+1):[];
  return {measured,fairness,unique:[...new Set([...measured,...fairness])]};
}
