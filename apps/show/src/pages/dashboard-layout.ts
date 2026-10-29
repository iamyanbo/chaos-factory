import type { GameDefinition } from '../games/contract';
import { isDefaultGame } from '../games/contract';
import './dashboard.css';
import { musicButton } from './music-control';

export function dashboardLayout(games: readonly GameDefinition[]): string {
  return `<div class="shell dashboard-shell">
    <header>
      <a class="wordmark" href="/dashboard"><span class="brand-icon">✳</span> CHAOS<span>FACTORY</span></a>
      <nav>${musicButton()}<span id="connection" class="status">Connecting…</span>
        <a class="pill-link" href="/play">Play offline ↗</a>
        <a class="pill-link" href="/show?manual=1" target="_blank">Open show ↗</a>
      </nav>
    </header>
    <div class="masthead"><div><h1>Dashboard</h1><p id="bridge-mode" class="muted small">Connecting…</p></div>
      <div id="twitch-badge" class="live-badge">Connecting…</div>
    </div>
    <section class="on-air">
      <div class="on-air-main"><h2 id="live-title">No show open</h2>
        <p id="live-state" class="muted small">Open the show to start.</p></div>
      <div class="readouts">
        <div><strong id="round">—</strong><small>ROUND</small></div>
        <div><strong id="clock">—</strong><small>SECONDS</small></div>
        <div><strong id="viewers">0</strong><small>PLAYERS</small></div>
      </div>
    </section>
    <main class="dashboard-main">
      <section class="library"><div class="section-heading"><h2>Choose a game</h2><span class="library-count">${games.length} games</span></div>
        <div class="game-grid">${games.map(game => `<article class="game-card" data-game="${game.id}">
          <div class="game-art"><img class="game-preview" src="/game-previews/${game.id}.webp"
            alt="${game.title} gameplay preview" width="640" height="640" loading="lazy" decoding="async"></div>
          <div class="game-copy"><span class="game-kind">${game.spectator ? 'Team event' : 'Join & watch'}</span>
            <h3>${game.title}</h3><p>${game.tagline}</p>
            <div class="game-actions"><button data-add="${game.id}" class="button compact">+ Queue</button>
              <a href="/play?game=${game.id}" class="preview-link">Play offline ↗</a></div>
          </div>
        </article>`).join('')}</div>
      </section>
      <aside class="dashboard-sidebar">
        <section class="card cup-card"><div class="section-heading"><h2>Show controls</h2><span class="cup-badge">5 rounds</span></div>
          <button id="start" class="button primary">▶ Start a Cup</button>
          <div class="button-row playback-controls" hidden>
            <button data-cmd="pause" class="button">Pause</button>
            <button data-cmd="resume" class="button" hidden>Resume</button>
            <button data-cmd="skip" class="button">Skip round</button>
          </div>
          <p id="notice" class="muted small">Open the show before starting a Cup.</p>
          <details class="more-controls"><summary>More controls</summary><div class="button-row">
            <button data-cmd="forceVoid" class="button danger">Void + refund</button>
            <button data-cmd="endCup" class="button">End Cup</button>
          </div></details>
        </section>
        <section class="card queue-card"><div class="section-heading"><h2>Up next</h2>
          <button id="clear-queue" class="text-button">Clear</button></div>
          <p id="queue-instructions" class="queue-help" hidden>Drag to reorder</p>
          <ol id="queue" class="queue"></ol>
          <p id="queue-empty" class="muted small">Automatic rotation<br><span>Add games to set the order.</span></p>
        </section>
      </aside>
    </main>
    <div class="dashboard-secondary">
    <details id="cup-details" class="card dashboard-details"><summary>Cup standings</summary>
      <div class="details-content"><p><strong id="score">—</strong> <span id="score-label" class="muted small">CUP LEADER</span></p>
        <table><thead><tr><th>Rank</th><th>Viewer</th><th>Points</th></tr></thead><tbody id="cup-standings"></tbody></table>
      </div>
    </details>
    <details id="show-settings" class="card dashboard-details"><summary>Settings</summary>
      <div class="details-content settings-grid">
        <section><h3>Cup</h3><p class="muted small">5 rounds, ending with a Grand Final.</p>
          <label>Mode<select id="mode"><option value="auto">Automatic</option><option value="cvs">Streamer / Free for all</option><option value="faction">Faction War</option></select></label>
          <label>Teams<select id="teams"><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option></select></label>
        </section>
        <section><h3>Predictions</h3>
          <label class="toggle"><input id="wagers" type="checkbox" checked><span>Mock predictions</span><small>Simulated points</small></label>
          <label class="inline-range">Betting window <input id="bet-window" type="range" min="30" max="120" value="30"><output id="bet-value">30s</output></label>
          <p id="prediction-status" class="small">No Prediction open</p><p id="prediction-pool" class="muted small"></p>
        </section>
        <section class="rotation-settings"><h3>Rotation & player limits</h3>
          ${games.map(game => `<div class="game-options" data-options="${game.id}">
            <label class="toggle"><input type="checkbox" data-enable="${game.id}" ${isDefaultGame(game) ? 'checked' : ''}>${game.title}</label>
          </div>`).join('')}
        </section>
      </div>
    </details>
    <details id="broadcast-settings" class="card dashboard-details"><summary>OBS & audio</summary>
      <div class="details-content"><p class="small">Browser source: <code id="obs-url"></code><br>1920 × 1080 · 60 fps</p>
        <label class="inline-range">Volume<input id="volume" type="range" min="0" max="1" step="0.01" value="0.5"></label>
        <label class="toggle"><input id="transparent" type="checkbox"><span>Transparent background</span></label>
        <details><summary>Webcam safe zone</summary><div id="safe-editor"><div id="safe-rect"></div></div>
          <div class="form-row safe-fields">${['x', 'y', 'w', 'h'].map((name, index) => `<label>${name.toUpperCase()}<input id="safe-${name}" type="number" min="0" max="1920" value="${[1440, 810, 480, 270][index]}"></label>`).join('')}</div>
          <button id="safe-apply" class="button">Apply safe zone</button>
        </details>
      </div>
    </details>
    <details id="mock-testing" class="card dashboard-details"><summary>Offline testing</summary>
      <section class="details-content"><div class="form-row">
          <label>Viewers<input id="mock-viewers" type="number" min="0" max="500" value="60"></label>
          <label>Activity<input id="activity" type="number" min="0" max="1" step="0.05" value="0.45"></label>
        </div>
        <details><summary>Chat delay</summary><div class="form-row">
          <label>Minimum (ms)<input id="delay-min" type="number" min="0" max="15000" value="2500"></label>
          <label>Maximum (ms)<input id="delay-max" type="number" min="0" max="15000" value="4500"></label>
        </div></details>
        <button id="swarm" class="button">Apply crowd settings</button>
        <form id="chat-form"><div class="form-row"><label>Username<input id="login" maxlength="25" pattern="[a-zA-Z0-9_]+" value="you" required></label>
          <label class="grow">Message<input id="chat" maxlength="500" placeholder="!join" required></label>
          <button class="button" type="submit">Send</button>
        </div></form>
      </section>
    </details>
    <details id="dashboard-logs" class="card dashboard-details"><summary>Logs</summary>
      <pre id="logs" class="details-content">Connecting…</pre>
    </details>
    </div>
  </div>`;
}
