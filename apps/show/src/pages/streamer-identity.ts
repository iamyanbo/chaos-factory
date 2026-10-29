/** Read public account identity only. Offline games never open a chat connection. */
export async function connectedStreamerName(): Promise<string | undefined> {
  try {
    const response = await fetch('/api/twitch/status', { signal: AbortSignal.timeout(800) });
    if (!response.ok) return;
    const status: unknown = await response.json();
    if (!status || typeof status !== 'object') return;
    const value = status as Record<string, unknown>;
    if (value.mode !== 'live' || !(value.authenticated || value.connected)) return;
    const name = value.displayName || value.channel;
    return typeof name === 'string' && name.length <= 100 ? name : undefined;
  } catch { return; }
}
