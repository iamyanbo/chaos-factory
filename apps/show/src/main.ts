import './style.css';
import { installToyCss } from './kit/theme/css';

installToyCss();
const host = document.querySelector<HTMLElement>('#app')!;
const route = location.pathname.split('/')[1];
try {
  if (route === 'show' || route === 'play') await (await import('./pages/show')).show(host);
  else if (route === 'preview') await (await import('./pages/preview')).preview(host);
  else if (route === 'controller') (await import('./pages/controller')).controller(host);
  else (await import('./pages/dashboard')).dashboard(host);
} catch (error) {
  host.replaceChildren();
  const message = document.createElement('pre');
  message.textContent = `Chaos Factory could not start:\n${String(error)}`;
  host.append(message);
  console.error(error);
}
