import type { Prediction, ChatMessage } from '@chaos/shared';
import type { HelixPrediction } from '@twurple/api';
import type { EventSubChannelChatMessageEvent, EventSubChannelPredictionBeginEvent,
  EventSubChannelPredictionProgressEvent, EventSubChannelPredictionLockEvent,
  EventSubChannelPredictionEndEvent } from '@twurple/eventsub-base';

type PredictionEvent = EventSubChannelPredictionBeginEvent | EventSubChannelPredictionProgressEvent
  | EventSubChannelPredictionLockEvent | EventSubChannelPredictionEndEvent;

export function helixPrediction(value: HelixPrediction): Prediction {
  return {
    id: value.id,
    status: value.status.toUpperCase() as Prediction['status'],
    locksAt: value.creationDate.getTime() + value.autoLockAfter * 1000,
    outcomes: value.outcomes.map(outcome => ({
      id: outcome.id, title: outcome.title, users: outcome.users, points: outcome.totalChannelPoints,
      top: outcome.topPredictors.map(user => ({ userId: user.userId, login: user.userName,
        points: user.channelPointsUsed }))
    })),
    winnerIndex: value.winningOutcomeId
      ? value.outcomes.findIndex(outcome => outcome.id === value.winningOutcomeId) : undefined
  };
}

export function eventPrediction(value: PredictionEvent, status: Prediction['status']): Prediction {
  return {
    id: value.id, status,
    locksAt: 'lockDate' in value ? value.lockDate.getTime() : undefined,
    outcomes: value.outcomes.map(outcome => ({
      id: outcome.id, title: outcome.title,
      users: 'users' in outcome ? outcome.users : 0,
      points: 'channelPoints' in outcome ? outcome.channelPoints : 0,
      top: 'topPredictors' in outcome ? outcome.topPredictors.map(user => ({
        userId: user.userId, login: user.userName, points: user.channelPointsUsed
      })) : []
    })),
    winnerIndex: 'winningOutcomeId' in value && value.winningOutcomeId
      ? value.outcomes.findIndex(outcome => outcome.id === value.winningOutcomeId) : undefined
  };
}

export function eventChat(value: EventSubChannelChatMessageEvent, now = Date.now()): ChatMessage {
  return {
    type: 'chat', userId: value.chatterId, login: value.chatterName,
    displayName: value.chatterDisplayName, color: value.color ?? '#a98bff',
    text: value.messageText.slice(0, 500), isMod: value.hasBadge('moderator'),
    isBroadcaster: value.chatterId === value.broadcasterId, receivedAt: now
  };
}
