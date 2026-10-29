import { TEAM_IDS } from './teams';
import type { TeamId } from './types';
export type ParsedChat = { kind: 'join'; teamId?: TeamId };

export function parseChat(text: string): ParsedChat | null {
  const clean = text.normalize('NFKC').trim().toLowerCase();
  const match = /^!?join(?:\s+([a-z]+))?$/.exec(clean);
  if (!match) return null;
  const teamId = TEAM_IDS.find(team => team === match[1]);
  if (match[1] && !teamId) return null;
  return { kind: 'join', teamId };
}
export class RateLimit{
  private times=new Map<string,number>();
  allow(key:string,now:number,interval:number):boolean{const last=this.times.get(key);if(last!==undefined&&now-last<interval)return false;this.times.set(key,now);if(this.times.size>5000)for(const[k,t]of this.times)if(now-t>60000)this.times.delete(k);return true;}
}
