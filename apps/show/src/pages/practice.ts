import { games, registry } from "../games/registry";
import type { Director } from "../director/director";
import type { Input } from "../engine/input";
import "./practice.css";
import { musicButton } from "./music-control";

export class PracticePanel {
  readonly stage: HTMLElement;
  private director?: Director;
  private startPaused: boolean;
  private initialSeed?: number;
  private botsInput: HTMLInputElement;
  private limitInput: HTMLInputElement;
  private role: HTMLElement;
  private joinButton: HTMLButtonElement;
  private pauseButton: HTMLButtonElement;
  private resultActions: HTMLElement;

  constructor(
    private host: HTMLElement,
    private params: URLSearchParams,
  ) {
    const available = [...games];
    const requested = registry.get(params.get('game') ?? '');
    if (requested && !available.some(game => game.id === requested.id)) available.push(requested);
    host.innerHTML = `<main class="practice-shell practice-focus">
      <div class="practice-toolbar">
        <div class="practice-heading"><a class="wordmark" href="/dashboard">CHAOS FACTORY</a></div>
        <form id="practice-settings">
          <label>Game<select id="practice-game">${available
            .map((game) => `<option value="${game.id}">${game.title}</option>`)
            .join("")}</select></label>
          <label>Format<select id="practice-format"></select></label>
          <label>Teams<select id="practice-teams"><option>2</option><option>3</option><option selected>4</option></select></label>
          <label>Bots<input id="practice-bots" type="number" min="0" max="64" value="24"></label>
          <label>Player limit<input id="practice-capacity" type="number" min="1" max="64" value="64"></label>
          <button class="button mint-button" type="submit">Restart round</button>
          <button id="practice-new" class="button" type="button">New round</button>
        </form>
        <div class="practice-status">
          <div class="practice-explanation"><p id="practice-role">Preparing…</p></div>
          <button id="practice-expand" class="button compact">Show settings</button>
          <button id="practice-pause" class="button compact">Pause</button>
          <label class="toggle"><input id="practice-sound" type="checkbox" checked>Effects</label>
          ${musicButton()}
        </div>
      </div>
      <section id="practice-stage" class="practice-stage" aria-label="Game arena"></section>
      <section class="practice-actions">
        <div id="practice-join-panel"><button id="practice-join" class="button primary">!join next round</button>
          <span id="practice-join-status">Join the next round. Games play automatically.</span></div>
      </section>
    </main>`;
    const get = <T extends HTMLElement>(id: string) =>
      host.querySelector<T>(`#${id}`)!;
    this.stage = get("practice-stage");
    this.resultActions = document.createElement('div');
    this.resultActions.className = 'practice-result-actions';
    this.resultActions.setAttribute('role', 'group');
    this.resultActions.setAttribute('aria-label', 'Round actions');
    this.resultActions.hidden = true;
    this.resultActions.innerHTML = `<button type="button" id="practice-again" class="button primary">Play again</button>
      <button type="button" id="practice-choose" class="button">Change game</button>`;
    this.stage.append(this.resultActions);
    this.role = get("practice-role");
    this.joinButton = get("practice-join");
    this.pauseButton = get("practice-pause");
    this.botsInput = get("practice-bots");
    this.limitInput = get("practice-capacity");
    // Explicit seeds remain a QA/reproduction hook, never a player setting.
    if (params.has("seed")) this.initialSeed = Number(params.get("seed")) >>> 0;
    this.botsInput.value = String(
      params.has("bots")
        ? Math.max(0, Math.min(64, Number(params.get("bots")) || 0))
        : 24,
    );
    this.limitInput.value = String(
      params.has("capacity")
        ? Math.max(1, Math.min(64, Number(params.get("capacity")) || 64))
        : 64,
    );
    const select = get<HTMLSelectElement>("practice-game");
    select.value = registry.has(params.get("game") ?? "")
      ? params.get("game")!
      : games[0].id;
    this.buildFormats(params.get("format"));
    if (params.has("teams"))
      get<HTMLSelectElement>("practice-teams").value = String(
        Math.max(2, Math.min(registry.get(select.value)!.maxTeams ?? 4, Number(params.get("teams")) || 4)),
      );
    const selected = registry.get(select.value)!;
    if (params.has('bots')) this.botsInput.value = String(Math.max(0, Math.min(selected.maxParticipants, Number(params.get('bots')) || 0)));
    this.limitInput.value = String(params.has('capacity') ? Math.max(1, Math.min(selected.maxParticipants, Number(params.get('capacity')) || selected.maxParticipants)) : selected.maxParticipants);
    if (!params.has("bots"))
      this.botsInput.value = String(selected.defaultBots ?? 24);
    this.limitInput.value = String(
      Math.min(selected.maxParticipants, Number(this.limitInput.value)),
    );
    this.startPaused = params.has("paused");
    get<HTMLInputElement>("practice-sound").checked = !params.has("mute");
    if (params.has("record"))
      host.querySelector("main")!.classList.add("practice-record");
  }

  private buildFormats(preferred: string | null = null): void {
    const selected =
      this.host.querySelector<HTMLSelectElement>("#practice-game")!.value;
    const game = registry.get(selected)!;
    const control =
      this.host.querySelector<HTMLSelectElement>("#practice-format")!;
    const formats = game.formats ?? [game.spectator ? "faction" : "ffa"];
    const labels = {
      boss: "Streamer vs Chat",
      ffa: "Free for all",
      faction: "Faction War",
    };
    control.replaceChildren(
      ...formats.map((format) => new Option(labels[format], format)),
    );
    if (preferred && formats.includes(preferred as "boss" | "ffa" | "faction"))
      control.value = preferred;
    const teams = this.host.querySelector<HTMLSelectElement>('#practice-teams')!;
    const previousTeams = Number(teams.value) || 4;
    const maximumTeams = Math.min(4, game.maxTeams ?? 4);
    teams.replaceChildren(...Array.from({ length: maximumTeams - 1 }, (_, index) =>
      new Option(String(index + 2), String(index + 2))));
    teams.value = String(Math.max(2, Math.min(maximumTeams, previousTeams)));
    this.host
      .querySelector<HTMLSelectElement>("#practice-teams")!
      .closest("label")!.hidden = control.value !== "faction";
  }

  connect(
    director: Director,
    input: Input,
    canvas: HTMLCanvasElement,
    sound: (enabled: boolean) => void,
  ): void {
    this.director = director;
    canvas.tabIndex = 0;
    const start = () => {
      const selected =
        this.host.querySelector<HTMLSelectElement>("#practice-game")!.value;
      const game = registry.get(selected)!;
      canvas.setAttribute("aria-label", `${game.title} arena`);
      this.host.querySelector<HTMLElement>('#practice-join-status')!.textContent = game.audienceIndependent
        ? 'Fixed team balls. Joining adds your name to their rotation.'
        : 'Join the next round. Games play automatically.';
      const capacity = Math.max(
        1,
        Math.min(game.maxParticipants, Number(this.limitInput.value)),
      );
      const format = this.host.querySelector<HTMLSelectElement>(
        "#practice-format",
      )!.value as "boss" | "ffa" | "faction";
      const bots = Math.max(
        0,
        Math.min(capacity, Math.floor(Number(this.botsInput.value))),
      );
      this.host.querySelector<HTMLElement>(".practice-actions")!.hidden =
        Boolean(game.spectator);
      this.botsInput.closest("label")!.hidden = Boolean(game.spectator);
      this.limitInput.closest("label")!.hidden = Boolean(game.spectator);
      this.botsInput.max = String(game.maxParticipants);
      this.limitInput.max = String(game.maxParticipants);
      input.release();
      director.startPractice({
        gameId: game.id,
        mode: format === "faction" ? "faction" : "cvs",
        role: "chatter",
        format,
        seed: this.initialSeed ?? crypto.getRandomValues(new Uint32Array(1))[0],
        bots,
        team: "red",
        capacity,
        competition: format === "ffa" ? "individual" : "team",
        teamCount: Number(
          this.host.querySelector<HTMLSelectElement>("#practice-teams")!.value,
        ),
      });
      this.initialSeed = undefined;
      if (this.startPaused)
        director.command({ type: "director.command", cmd: "pause" });
      this.startPaused = false;
      const enabled =
        this.host.querySelector<HTMLInputElement>("#practice-sound")!.checked;
      sound(enabled);
      canvas.focus({ preventScroll: true });
    };
    this.host.querySelector<HTMLFormElement>("#practice-settings")!.onsubmit = (
      event,
    ) => {
      event.preventDefault();
      start();
    };
    this.host.querySelector<HTMLSelectElement>("#practice-game")!.onchange =
      () => {
        this.buildFormats();
        const definition = registry.get(
          this.host.querySelector<HTMLSelectElement>("#practice-game")!.value,
        )!;
        this.limitInput.value = String(definition.maxParticipants);
        this.botsInput.value = String(definition.defaultBots ?? 24);
        start();
      };
    this.host.querySelector<HTMLSelectElement>("#practice-format")!.onchange =
      () => {
        this.host
          .querySelector<HTMLSelectElement>("#practice-teams")!
          .closest("label")!.hidden =
          this.host.querySelector<HTMLSelectElement>("#practice-format")!
            .value !== "faction";
        start();
      };
    this.host.querySelector<HTMLSelectElement>("#practice-teams")!.onchange =
      start;
    this.host.querySelector<HTMLButtonElement>("#practice-new")!.onclick =
      () => {
        start();
      };
    this.pauseButton.onclick = () =>
      director.command({
        type: "director.command",
        cmd: director.paused ? "resume" : "pause",
      });
    this.joinButton.onclick = () => {
      director.practiceChat("!join");
      if (!director.ctx?.setup.participants.length) start();
    };
    this.host.querySelector<HTMLButtonElement>("#practice-expand")!.onclick = (
      event,
    ) => {
      const focused = this.host
        .querySelector("main")!
        .classList.toggle("practice-focus");
      (event.currentTarget as HTMLButtonElement).textContent = focused
        ? "Show settings"
        : "Expand game";
    };
    this.host.querySelector<HTMLInputElement>("#practice-sound")!.onchange = (
      event,
    ) => {
      const enabled = (event.target as HTMLInputElement).checked;
      sound(enabled);
    };
    this.host.querySelector<HTMLButtonElement>('#practice-again')!.onclick = () => start();
    this.host.querySelector<HTMLButtonElement>('#practice-choose')!.onclick = () => {
      this.host.querySelector('main')!.classList.remove('practice-focus');
      this.host.querySelector<HTMLButtonElement>('#practice-expand')!.textContent = 'Expand game';
      const select = this.host.querySelector<HTMLSelectElement>('#practice-game')!;
      select.focus();
      select.scrollIntoView({ block: 'nearest' });
    };
    start();
  }

  update(): void {
    const director = this.director;
    if (!director) return;
    const joined = director.ctx?.setup.participants.some(
      (p) => p.userId === "offline-player",
    );
    const queued =
      !joined && director.participants.members.has("offline-player");
    this.resultActions.hidden = director.phase !== "RESULT" || this.params.has("record");
    this.role.textContent = director.takePending
      ? "Loading game…"
      : director.phase === "RESULT"
        ? "Round complete"
        : director.game.spectator
          ? "Fixed team machines. No joining needed."
          : queued
            ? "You are queued. Restart to join the next round."
            : joined
              ? director.game.audienceIndependent
                ? "Your name rotates onto your team's balls when tiles flip."
                : "Your ball is named YOU."
              : director.game.audienceIndependent
                ? "Watching fixed team balls. Joining is optional."
                : "Watching offline bots. No Twitch connection needed.";
    this.joinButton.disabled = Boolean(joined || queued);
    this.joinButton.textContent = joined
      ? "Joined ✓"
      : queued
        ? "Queued for restart"
        : "!join next round";
    this.pauseButton.textContent = director.paused ? "Resume" : "Pause";
    this.pauseButton.disabled = !["PLAY", "LOCK_COUNTDOWN"].includes(
      director.phase,
    );
  }
}
