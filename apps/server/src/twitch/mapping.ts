import type { ChatMessage } from '@chaos/shared';
import type { EventSubChannelChatMessageEvent } from '@twurple/eventsub-base';

export function eventChat(value: EventSubChannelChatMessageEvent, now = Date.now()): ChatMessage {
  return {
    type: 'chat', userId: value.chatterId, login: value.chatterName,
    displayName: value.chatterDisplayName, color: value.color ?? '#a98bff',
    text: value.messageText.slice(0, 500), isMod: value.hasBadge('moderator'),
    isBroadcaster: value.chatterId === value.broadcasterId, receivedAt: now
  };
}
