import { musicPreference, saveMusicPreference, updateMusicButton } from './music-control';
import { isAutomatic } from '../games/contract';
import { showGames } from '../games/registry';
import { currentParticipation } from './game-participation';
import { Client } from '../net/client';
import { twitchPanel } from './twitch-panel';
import { dashboardLayout } from './dashboard-layout';
import { GameQueue } from './game-queue';
import { RoundStartControl, roundPhaseLabel } from './round-start';
import { roundCountdown } from '../hud/round-clock';
import { TEAMS, type DirectorState, type Message } from '@chaos/shared';
export function dashboard(host:HTMLElement):void{
  const games = showGames;
  document.body.className='control-room';
  host.innerHTML = dashboardLayout(games);
  const twitch = twitchPanel(host);
  const net=new Client('dashboard');const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;const value=(id:string)=>Number($<HTMLInputElement>(id).value);let state:DirectorState|undefined;const lines:string[]=[];
  const send=(cmd:Extract<Message,{type:'director.command'}>['cmd'],arg?:Extract<Message,{type:'director.command'}>['arg'])=>net.send({type:'director.command',cmd,arg});
  const music = host.querySelector<HTMLButtonElement>('.music-toggle')!;
  let musicEnabled = musicPreference();
  updateMusicButton(music, musicEnabled);
  music.onclick = () => {
    musicEnabled = !musicEnabled;
    saveMusicPreference(musicEnabled);
    updateMusicButton(music, musicEnabled);
    send('music', musicEnabled);
  };
  const roundStart = new RoundStartControl(send);
  const queueView = new GameQueue($<HTMLOListElement>('queue'), $('queue-empty'),
    $<HTMLButtonElement>('clear-queue'), games, ids => send('queue', ids));
  addEventListener('beforeunload', () => queueView.destroy(), { once: true });
  $('start').after(roundStart.root);
  for(const game of games.filter(g=>g.joinOnly)){
    const label=document.createElement('label');label.className='game-capacity';label.textContent='Player limit';
    const input=document.createElement('input');input.type='number';input.min='1';input.max=String(game.maxParticipants);input.value=String(game.maxParticipants);input.dataset.capacity=game.id;input.setAttribute('aria-label',`Player limit for ${game.title}`);
    input.onchange=()=>{const limit=Math.max(1,Math.min(game.maxParticipants,Math.floor(Number(input.value))||1));input.value=String(limit);send('setCapacity',{[game.id]:limit});};
    label.append(input);host.querySelector(`[data-options="${game.id}"]`)!.append(label);
  }
  $('obs-url').textContent=`${location.origin}/show?manual=1`;net.onConnection=connected=>{$('connection').textContent=connected?'● Bridge connected':'● Reconnecting';$('connection').classList.toggle('online',connected);};
  function renderRound(m:DirectorState):void{
    if (m.musicEnabled !== undefined) {
      musicEnabled = m.musicEnabled;
      updateMusicButton(music, musicEnabled);
    }
    const active = m.phase !== 'ATTRACT';
    $('start').hidden = active;
    host.querySelector<HTMLElement>('.playback-controls')!.hidden = !active;
    host.querySelector<HTMLElement>('[data-cmd="pause"]')!.hidden = Boolean(m.paused);
    host.querySelector<HTMLElement>('[data-cmd="resume"]')!.hidden = !m.paused;
    state=m;roundStart.update(m);if(m.teams&&document.activeElement!==$('teams'))$<HTMLSelectElement>('teams').value=String(m.teams.length);const game=games.find(g=>g.id===m.gameId),automatic=Boolean(game&&isAutomatic(game)),event=Boolean(game?.spectator);
    $('live-title').textContent=game?.title??m.gameId;
    $('live-state').textContent=`${roundPhaseLabel(m)} · ${currentParticipation(game, m)}`;
    if (m.enabledGames) host.querySelectorAll<HTMLInputElement>('[data-enable]').forEach(input => {
      input.checked = m.enabledGames!.includes(input.dataset.enable!);
    });
    $('round').textContent=String(m.round);$('clock').textContent=String(Math.max(0,Math.ceil(m.timeLeft)));$('viewers').textContent=event?String(m.teams?.length??4):automatic?`${m.participants??0}/${m.capacity??game!.maxParticipants}`:String(m.participants??0);
    const countdown = roundCountdown(game?.ending, m.phase, m.timeLeft);
    $('clock').parentElement!.hidden = Boolean(m.waitingForHost || m.preparingRound || m.phase === 'PLAY' && countdown === undefined);
    if (countdown !== undefined) $('clock').textContent = String(countdown);
    host.querySelectorAll<HTMLInputElement>('[data-capacity]').forEach(input=>{if(document.activeElement!==input)input.value=String(m.capacities?.[input.dataset.capacity!]??games.find(g=>g.id===input.dataset.capacity)!.maxParticipants);});
    $('viewers').nextElementSibling!.textContent=event?'TEAMS':game?.participantNoun === 'supporter'?'SUPPORTERS':'PLAYERS';
    $('notice').textContent = m.waiting ? `${m.waiting} waiting for the next round.`
      : event ? 'No joining needed.' : m.phase === 'ATTRACT' ? '5 rounds · Blade Brawl Grand Final.'
        : m.waitingForHost ? 'Viewers can still type !join.' : '';
    $('notice').hidden = !$('notice').textContent;
    if (m.queue) queueView.set(m.queue);
  }
  net.onMessage=m=>{twitch(m);if(m.type==='director.state')renderRound(m);
    else if(m.type==='server.log'){lines.push(`${new Date(m.at).toLocaleTimeString()}  ${m.level.toUpperCase()}  ${m.message}`);$('logs').textContent=lines.slice(-40).join('\n');}
    else if(m.type==='mock.status'){for(const[id,value]of Object.entries({'mock-viewers':m.viewers,activity:m.activity,'delay-min':m.delayMs[0],'delay-max':m.delayMs[1]}))$<HTMLInputElement>(id).value=String(value);for(const[name,weight]of Object.entries(m.personalities)){const input=document.getElementById(`personality-${name}`)as HTMLInputElement|null;if(input)input.value=String(weight);}}
  };
  $('start').onclick=()=>{if(!state){$('notice').textContent='Open the show first, then start a round.';return;}send('start');};
  host.querySelectorAll<HTMLButtonElement>('[data-cmd]').forEach(b=>b.onclick=()=>send(b.dataset.cmd as 'pause'));
  host.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(b=>b.onclick=()=>{queueView.add(b.dataset.add!);b.textContent='✓ Queued';setTimeout(()=>b.textContent='+ Queue',900);});
  host.querySelectorAll<HTMLInputElement>('[data-enable]').forEach(c=>c.onchange=()=>send('enableGame',c.dataset.enable));
  $('mode').onchange=()=>send('setMode',$<HTMLSelectElement>('mode').value);$('teams').onchange=()=>send('setTeams',value('teams'));
  for(const[id,cmd]of[['transparent','transparent']]as const)$(id).onchange=()=>send(cmd,$<HTMLInputElement>(id).checked);
  $('volume').oninput=()=>send('audio',value('volume'));
  $('swarm').onclick=()=>{net.send({type:'mock.swarm',viewers:Math.max(0,Math.min(500,value('mock-viewers'))),activity:Math.max(0,Math.min(1,value('activity'))),delayMs:[value('delay-min'),value('delay-max')]});$('notice').hidden=false;$('notice').textContent='Mock crowd settings applied.';};
  $('chat-form').onsubmit=e=>{e.preventDefault();net.send({type:'mock.chat',login:$<HTMLInputElement>('login').value,text:$<HTMLInputElement>('chat').value});$<HTMLInputElement>('chat').value='';};
  const safe=()=>({x:value('safe-x'),y:value('safe-y'),w:value('safe-w'),h:value('safe-h')});function drawSafe(){const r=safe();Object.assign($('safe-rect').style,{left:`${r.x/19.2}%`,top:`${r.y/10.8}%`,width:`${r.w/19.2}%`,height:`${r.h/10.8}%`});}drawSafe();$('safe-apply').onclick=()=>{drawSafe();send('safeZone',safe());};
  let drag=false;$('safe-rect').onpointerdown=e=>{drag=true;$('safe-rect').setPointerCapture(e.pointerId);};$('safe-rect').onpointerup=()=>{drag=false;send('safeZone',safe());};$('safe-rect').onpointermove=e=>{if(!drag)return;const box=$('safe-editor').getBoundingClientRect();$<HTMLInputElement>('safe-x').value=String(Math.round(Math.max(0,Math.min(1920-value('safe-w'),(e.clientX-box.left)/box.width*1920-value('safe-w')/2))));$<HTMLInputElement>('safe-y').value=String(Math.round(Math.max(0,Math.min(1080-value('safe-h'),(e.clientY-box.top)/box.height*1080-value('safe-h')/2))));drawSafe();};
}
