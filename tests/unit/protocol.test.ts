import { expect,test } from 'vitest';
import { messageSchema,newViewerProfile,type Message } from '@chaos/shared';
test('every protocol message round-trips through JSON and zod',()=>{
  const result={winner:{kind:'chat' as const},mvps:[],highlights:[],perUser:{a:{score:1,tags:['win']}},replay:{seed:42,inputs:[]}};
  const messages:Message[]=[
    {type:'hello',role:'show'},{type:'chat',userId:'a',login:'a',displayName:'A',color:'#fff',text:'!join',isMod:false,isBroadcaster:false,receivedAt:0},
    {type:'prediction.update',id:'p',status:'ACTIVE',outcomes:[{id:'a',title:'A',users:1,points:10,top:[{userId:'a',login:'a',points:10}]}]},
    {type:'prediction.error',op:'create',code:'RATE_LIMIT',message:'Retry'}, {type:'streamer.input',action:'left',pressed:true,seq:1}, {type:'director.command',cmd:'safeZone',arg:{x:1440,y:810,w:480,h:270}},
    {type:'twitch.status',mode:'mock',connected:true,channel:'mock',canPredict:true}, {type:'stats.snapshot',users:{},factions:{}}, {type:'prediction.create',title:'Who wins?',outcomes:['A','B'],windowSec:30},
    {type:'profiles.snapshot',users:{a:newViewerProfile({userId:'a',login:'a',displayName:'A'})},crownUserId:'a',lastWinners:{'ring-escape':'@A'}},
    {type:'prediction.lock'}, {type:'prediction.resolve',outcomeIndex:0},{type:'prediction.cancel',reason:'void'}, {type:'round.record',gameId:'ring-escape',mode:'cvs',result},
    {type:'director.state',phase:'PLAY',gameId:'ring-escape',mode:'cvs',timeLeft:60,cup:{round:1,rounds:3,chat:0,streamer:0,teams:{}}},
    {type:'mock.chat',login:'you',text:'!join'}, {type:'mock.swarm',viewers:60,activity:.5,delayMs:[2500,4500]},
    {type:'mock.status',viewers:60,activity:.5,delayMs:[2500,4500],personalities:{loyal:1}}, {type:'server.log',level:'info',message:'Ready',at:0}, {type:'ping',at:0}, {type:'pong',at:0}
  ];
  for(const m of messages)expect(messageSchema.parse(JSON.parse(JSON.stringify(m)))).toEqual(m);
  expect(new Set(messages.map(m=>m.type))).toEqual(new Set(messageSchema.options.map(s=>s.shape.type.value)));
});
