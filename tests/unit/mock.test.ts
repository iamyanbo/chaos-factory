import { describe, expect, test } from 'vitest';
import { MockBridge } from '../../apps/server/src/twitch/mock';
import type { ChatMessage } from '@chaos/shared';
describe('mock bridge',()=>{
  test('bots send delayed joins and ignore manual non-join chat', () => {
    let time = 0;
    const bridge = new MockBridge(24, [2500, 2500], () => time);
    for (const bot of bridge.bots) bot.nextAt = 0;
    const messages: ChatMessage[] = [];
    bridge.onChat = message => messages.push(message);
    bridge.tick();
    time = 2499;
    bridge.tick();
    expect(messages).toHaveLength(0);
    time = 2500;
    bridge.tick();
    expect(messages).toHaveLength(24);
    expect(messages.every(message => message.text === '!join')).toBe(true);
    bridge.manual('offline_viewer', '!join');
    expect(messages.at(-1)).toMatchObject({ text: '!join' });
    bridge.manual('offline_viewer', 'hello');
    bridge.manual('offline_viewer', '!help');
    expect(messages).toHaveLength(25);
  });
  test('reducing the swarm removes delayed joins from departed simulated viewers',()=>{
    let time=0;
    const bridge=new MockBridge(40,[2500,2500],()=>time);
    for(const bot of bridge.bots)bot.nextAt=0;
    const senders:string[]=[];
    bridge.onChat=message=>senders.push(message.userId);
    bridge.tick();
    bridge.configure(4,1,[2500,2500]);
    time=2500;
    bridge.tick();
    expect(senders).toHaveLength(4);
    expect(senders.every(id=>bridge.bots.some(bot=>bot.login===id))).toBe(true);
  });
  test('honors stream delay and manual join is immediate',()=>{let time=0;const b=new MockBridge(1,[2500,2500],()=>time);b.activity=1;b.bots[0].nextAt=0;const chats:string[]=[];b.onChat=m=>chats.push(m.text);b.tick();expect(chats).toEqual([]);time=2499;b.tick();expect(chats).toEqual([]);time=2500;b.tick();expect(chats.length).toBe(1);b.manual('you','!join');expect(chats.at(-1)).toBe('!join');});
});
