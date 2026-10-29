import type { Message } from '@chaos/shared';
import { TwitchConnect } from './twitch-connect';

export function twitchPanel(host: HTMLElement): (message: Message) => void {
  const section = document.createElement('details');
  section.className = 'card dashboard-details connection-panel';
  section.hidden = true;
  const title = document.createElement('summary');
  title.textContent = 'Twitch connection';
  const brief = document.createElement('span');
  title.append(brief);
  let authenticated: boolean | undefined;
  const status = document.createElement('p');
  status.className = 'muted';
  status.style.margin = '12px 0 18px';
  status.setAttribute('role', 'status');
  status.textContent = 'Waiting for the bridge…';
  const connect = document.createElement('a');
  connect.className = 'button primary';
  connect.textContent = 'Connect Twitch';
  connect.hidden = true;
  const device = new TwitchConnect();
  device.root.hidden = true;
  const facts = document.createElement('dl');
  facts.className = 'twitch-facts';
  facts.hidden = true;
  for (const [key, label] of [['authenticated', 'Account authorization'], ['account', 'Channel type'],
    ['eventsub', 'Chat connection'], ['last-join', 'Last !join']]) {
    const item = document.createElement('div');
    const name = document.createElement('dt');
    const value = document.createElement('dd');
    name.textContent = label;
    value.dataset.twitch = key;
    item.append(name, value);
    facts.append(item);
  }
  section.append(title, status, facts, connect, device.root);
  host.querySelector('.masthead')!.after(section);
  return message => {
    if (message.type === 'prediction.error') {
      host.querySelector('#prediction-status')!.textContent = 'NO WAGERS THIS ROUND';
      host.querySelector('#prediction-pool')!.textContent = message.message;
      return;
    }
    if (message.type !== 'twitch.status') return;
    const live = message.mode === 'live';
    section.hidden = !live;
    if (authenticated === undefined || authenticated !== Boolean(message.authenticated) || message.lastError) {
      section.open = live && (!message.authenticated || Boolean(message.lastError));
    }
    authenticated = Boolean(message.authenticated);
    brief.textContent = message.connected ? `Connected · @${message.channel}` : 'Not connected';
    const eyebrow = host.querySelector<HTMLElement>('#bridge-mode')!;
    eyebrow.textContent = live ? message.connected ? 'Twitch connected' : 'Twitch not connected' : 'Offline mode';
    eyebrow.dataset.mode = live ? 'live' : 'mock';
    eyebrow.dataset.connected = String(message.connected);
    const badge = host.querySelector<HTMLElement>('#twitch-badge')!;
    badge.replaceChildren();
    const heading = document.createElement('strong');
    heading.textContent = live ? message.connected ? 'TWITCH CONNECTED' : 'TWITCH OFFLINE' : 'MOCK MODE';
    const subtitle = document.createElement('small');
    subtitle.textContent = live ? message.channel : 'Simulated chat and predictions';
    badge.append(heading, document.createElement('br'), subtitle);
    device.update(message);
    facts.hidden = !live;
    const value = (key: string, content: string) => { facts.querySelector(`[data-twitch="${key}"]`)!.textContent = content; };
    value('authenticated', message.authenticated ? `Authorized as @${message.channel}` : 'Not authorized');
    value('account', message.broadcasterType === 'affiliate' ? 'Affiliate' : message.broadcasterType === 'partner'
      ? 'Partner' : message.authenticated ? 'Standard · chat only' : 'Not checked yet');
    value('eventsub', message.eventSubConnected ? 'Connected' : message.authenticated ? 'Connecting…' : 'Waiting for authorization');
    value('last-join', message.lastJoinAt ? new Date(message.lastJoinAt).toLocaleTimeString() : 'No joins received yet');
    connect.hidden = !live || !message.configured || message.authFlow === 'device';
    connect.href = message.loginUrl ?? 'http://localhost:4174/auth/login';
    connect.textContent = message.connected ? 'Reconnect Twitch' : 'Connect Twitch';
    status.textContent = !live ? 'Simulated chat and points. Offline games are always available.'
      : message.lastError ?? (message.connected
        ? `@${message.channel} · ${message.broadcasterType || 'Chat only'} · ${message.canPredict ? 'Native Predictions enabled' : 'No-wager rounds'}`
        : 'Connect the broadcaster account to receive real !join messages.');
    if (live && message.authenticated && !message.broadcasterType)
      status.textContent = `${message.connected ? 'Chat joins are enabled.' : 'Authorized. Connecting chat…'} Twitch Predictions require an Affiliate or Partner channel; rounds run without wagers.`;
    const crowd = host.querySelector<HTMLElement>('#mock-testing');
    if (crowd) crowd.hidden = live;
    const wagers = host.querySelector<HTMLInputElement>('#wagers')!;
    wagers.disabled = live && !message.canPredict;
    wagers.closest('label')!.querySelector('span')!.textContent = live ? 'Twitch Predictions' : 'Mock predictions';
    wagers.closest('label')!.querySelector('small')!.textContent = live
      ? 'Native channel points, settled by Twitch' : 'Simulated points, no real wagering';
  };
}
