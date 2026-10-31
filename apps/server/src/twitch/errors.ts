import { BridgeError } from './bridge';

/** Never forward upstream error bodies: OAuth responses can contain credentials. */
export function twitchError(error: unknown): BridgeError {
  if (error instanceof BridgeError) return error;
  const status = typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number(error.statusCode) : 0;
  if (status === 401) return new BridgeError('AUTH_REQUIRED', 'Reconnect Twitch to continue.');
  if (status === 403) return new BridgeError('NOT_ELIGIBLE', 'Twitch did not authorize this request.');
  if (status === 404) return new BridgeError('NOT_FOUND', 'The Twitch resource no longer exists.');
  if (status === 400) return new BridgeError('INVALID_STATE', 'Twitch rejected this request.');
  if (status === 429 || status >= 500 || !status)
    return new BridgeError('TWITCH_UNAVAILABLE', 'Twitch is unavailable; the round continues.', true);
  return new BridgeError('TWITCH_ERROR', 'Twitch could not complete this operation.');
}
