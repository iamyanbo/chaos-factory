import { Rng, TEAM_IDS, TEAMS, type Participant, type TeamId } from '@chaos/shared';
export class Participants {
  readonly members=new Map<string,Participant>();private active=new Map<string,number>();private rng=new Rng(457);
  private order=new Set<string>();private counts=new Map<TeamId,number>();
  teams:TeamId[]=TEAM_IDS.slice(0,4);crowd=0;
  join(user:Participant,time:number,pick?:TeamId):Participant{
    this.active.set(user.userId,time);const existing=this.members.get(user.userId);if(existing)return existing;
    const counts=this.teams.map(team=>({team,count:this.counts.get(team)??0}));counts.sort((a,b)=>a.count-b.count);
    const teamId=pick&&this.teams.includes(pick)?pick:counts[0].team;const p={...user,teamId,golden:this.rng.chance(.02)};this.members.set(p.userId,p);this.order.add(p.userId);this.counts.set(teamId,(this.counts.get(teamId)??0)+1);return p;
  }
  ordered():Participant[]{return [...this.order].map(id=>this.members.get(id)!);}
  roster(max:number,time:number):Participant[]{const all=this.ordered().filter(p=>time-(this.active.get(p.userId)??0)<600);this.crowd=Math.max(0,all.length-max);return all.slice(0,max);}
  finishRound(admitted:readonly string[]):void{for(const id of admitted)if(this.order.delete(id))this.order.add(id);}
  queuePosition(userId:string,playing:readonly string[]):number{const admitted=new Set(playing);if(admitted.has(userId))return 0;let n=0;for(const id of this.order){if(admitted.has(id))continue;n++;if(id===userId)return n;}return 0;}
  reassign(userId:string,team:TeamId):void{const p=this.members.get(userId);if(!p||p.teamId===team)return;if(p.teamId)this.counts.set(p.teamId,Math.max(0,(this.counts.get(p.teamId)??0)-1));p.teamId=team;p.color=TEAMS[team].color;this.counts.set(team,(this.counts.get(team)??0)+1);}
  capTeams(limit: number): void {
    if (this.teams.length <= limit) return;
    this.teams = this.teams.slice(0, Math.max(2, limit));
    for (const participant of this.ordered()) {
      if (participant.teamId && this.teams.includes(participant.teamId)) continue;
      const team = [...this.teams].sort((a,b) => (this.counts.get(a)??0)-(this.counts.get(b)??0))[0];
      this.reassign(participant.userId, team);
    }
  }
  reset(teams=4):void{this.members.clear();this.active.clear();this.order.clear();this.counts.clear();this.teams=TEAM_IDS.slice(0,Math.max(2,Math.min(6,teams)));}
  fill(count=60,time=0):void{const prefixes=['neon','cosmic','tiny','sleepy','spicy','lucky','minty','chaos','pixel','moon'];const animals=['otter','moth','fox','bean','frog','panda','ghost','duck'];for(let i=0;i<count;i++){const login=`${prefixes[i%10]}_${animals[Math.floor(i/10)%8]}${i>=80?i:''}`;this.join({userId:login,login,displayName:login,color:TEAMS[this.teams[i%this.teams.length]].color},time,this.teams[i%this.teams.length]);}}
}
