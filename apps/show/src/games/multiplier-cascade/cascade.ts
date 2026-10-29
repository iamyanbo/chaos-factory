import type { Graphics } from 'pixi.js';
import { type TeamId, type Winner } from '@chaos/shared';
import type { GameContext, GameDefinition } from '../contract';
import { defineEvent } from '../catalog';
import { SpectatorGame } from '../../kit/spectator-game';
import { NeonSound, rememberTrail } from '../../kit/neon';
import type { Marble } from '../../kit/marble';
import { CascadeBoard, BALL_RADIUS, GATE_Y } from './board';
import { COURSE, CLEAR_AT, EXPIRE_AT, GRAVITY, FEEDER_Y } from './course-layout';
import { CascadeView, updateCascadeHud } from './view';
import { scoreCascadeTake } from './score';
import { cascadeInspection } from './inspection';
import type { Banking, DropResult, PocketHit, Split, Stall, Unit } from './types';
import { collisionHandler, planChildren, cloneChildren, prepareUnit } from './units';
import { PocketCollector, summarizeDrop } from './banking';
import { CascadeRelay, RELAY_GOAL } from './relay';
import { CascadeCamera } from './camera';

const IMPACT_NOTE_GAP = 0.08;

/** One continuous eight-chamber machine feeds the first-to-five finish. */
export class MultiplierCascade extends SpectatorGame {
    readonly board: CascadeBoard;
    readonly scores = new Map<TeamId, number>();
    readonly bankings: Banking[] = [];
    readonly splits: Split[] = [];
    readonly drops: DropResult[] = [];
    readonly units = new Map<string, Unit>();
    readonly camera = new CascadeCamera();
    readonly seedsPerTeam: number;
    wave = 0;
    phase: 'drop' | 'relay' | 'complete' = 'drop';
    relay?: CascadeRelay;
    waveStart = 0;
    private serial = 0;
    private hits: PocketHit[] = [];
    private before = new Map<TeamId, number>();
    private born = 0;
    private lost = 0;
    private expired = 0;
    private banked = 0;
    readonly stalls: Stall[] = [];
    readonly contacts = { wheel: 0, seesaw: 0, sweeper: 0, marble: 0 };
    private lastImpact = 0;
    private view?: CascadeView;
    private sound: NeonSound;
    private collector = new PocketCollector();
    private flushWarning = false;
    private sudden = false;
    constructor(ctx: GameContext) {
        super(ctx, Number.POSITIVE_INFINITY);
        ctx.physics.world.gravity.y = GRAVITY;
        ctx.physics.world.numSolverIterations = 8;
        this.seedsPerTeam = this.teams.length > 4 ? 2 : 3;
        for (const team of this.teams)
            this.scores.set(team, 0);
        ctx.hud.setTeams(this.teams.map(team => ({ team, value: 0 })));
        this.board = new CascadeBoard(ctx, this.teams);
        ctx.camera.setViewport({ left: 420, right: 1500, top: 0, bottom: 1080, minZoom: 1 });
        ctx.camera.reserve({ x: 0, y: 0, w: 0, h: 0 });
        ctx.camera.follow({ x: 960, y: this.camera.y }, 1);
        this.sound = new NeonSound(ctx);
        if (!ctx.headless)
            this.view = new CascadeView(ctx);
        ctx.physics.onCollision = collisionHandler(this.units, this.contacts,
            (id, slot) => this.hits.push({ id, slot }), marble => {
                if (this.time - this.lastImpact <= IMPACT_NOTE_GAP) return;
                this.lastImpact = this.time;
                const velocity = marble.body.linvel();
                this.sound.bounce(Math.hypot(velocity.x, velocity.y) * 50);
            });
        this.beginDrop();
    }
    start(): void {
        if (this.started) return;
        super.start();
        for (const marble of this.marbles) marble.born = 0;
        this.announceDrop();
    }

    private announceDrop(): void {
        this.emit({ t: 'moment', text: 'CASCADE', intensity: 1 });
    }
    private beginDrop(): void {
        for (const m of this.marbles) {
            if (m.body.isValid())
                this.ctx.physics.remove(m.body);
            m.view?.destroy({ children: true, context: true });
        }
        this.marbles = [];
        this.units.clear();
        this.hits = [];
        this.wave++;
        this.phase = 'drop';
        this.waveStart = this.time;
        this.born = 0;
        this.lost = 0;
        this.expired = 0;
        this.banked = 0;
        this.flushWarning = false;
        this.before = new Map(this.scores);
        this.board.reset(this.wave);
        const batch = this.ctx.rng.shuffle(this.teams.flatMap(team =>
            Array.from({ length: this.seedsPerTeam }, (_, n) => ({ team, n }))));
        const b = this.board.bay();
        for (const [i, { team, n }] of batch.entries()) {
            const x = b.left + (i + .5) * b.w / batch.length + this.ctx.rng.range(-4, 4);
            this.spawnUnit(team, x, FEEDER_Y - this.ctx.rng.range(0, 2), 0, `root:${this.wave}:${team}:${n}`, this.ctx.rng.range(-.15, .15), 0);
        }
        if (this.started)
            this.announceDrop();
    }
    private spawnUnit(team: TeamId, x: number, y: number, stage: number,
        root: string, vx: number, vy: number, lineage = 1): Marble {
        const m = this.machineBall(team, this.serial++, x, y, BALL_RADIUS);
        this.units.set(m.id, prepareUnit(m, stage, root, vx, vy, lineage));
        this.born++;
        return m;
    }
    private remove(unit: Unit, lost = false): void {
        const marble = unit.marble;
        marble.alive = false;
        this.ctx.physics.remove(marble.body);
        this.units.delete(marble.id);
        if (lost) {
            this.lost++;
            this.view?.burst(marble.x, marble.y, marble.color, this.time, 4);
        }
    }
    private multiply(unit: Unit): void {
        const m = unit.marble;
        const stage = unit.stage;
        const i = this.teams.indexOf(m.team as TeamId);
        const requested = this.board.multiplier(i, stage, m.x);
        const exits = requested > 1 ? planChildren(this.ctx, this.board, unit, requested - 1, this.units) : [];
        const factor = exits ? requested : 1;
        if (!exits) this.board.bypass(stage, this.time - this.waveStart);
        if (factor > 1) this.board.pulses[stage] = this.time - this.waveStart;
        unit.stage++;
        unit.lineage *= factor;
        this.splits.push({ wave: this.wave, team: m.team as TeamId, id: m.id, stage, factor, requested, time: this.time });
        this.emit({ t: 'activity', time: this.time, kind: 'checkpoint' });
        if (!factor) {
            this.view?.multiply(m.x, m.y, 0, this.time);
            this.remove(unit, true);
            return;
        }
        if (factor > 1 && exits) {
            cloneChildren(this.ctx, unit, exits, (...args) => this.spawnUnit(...args), child => {
                this.view?.burst(child.x, child.y, child.color, this.time, 2);
                this.emit({ t: 'activity', time: this.time, kind: 'birth' });
            });
            this.sound.pass(stage + 1);
            this.view?.multiply(m.x, m.y, factor, this.time);
        }
    }
    private collect(): void {
        this.banked += this.collector.collect(this, this.hits, (unit, value) => {
            const m = unit.marble;
            this.view?.burst(m.x, m.y, m.color, this.time, value === 20 ? 9 : 3);
            this.emit({ t: 'activity', time: this.time, kind: 'checkpoint' });
            this.remove(unit);
        }, note => this.sound.pass(note));
        this.hits = [];
    }
    private leaders(): TeamId[] {
        const best = Math.max(...this.scores.values());
        return this.teams.filter(team => this.scores.get(team) === best);
    }
    private finishDrop(): void {
        this.drops.push(summarizeDrop(this, this.before, this.leaders(), {
            born: this.born, banked: this.banked, lost: this.lost, expired: this.expired
        }));
        for (const unit of [...this.units.values()]) this.remove(unit);
        this.marbles = [];
        this.board.retire();
        this.relay = new CascadeRelay(this.ctx, this.teams, this.scores);
        this.relay.sudden = this.sudden;
        this.phase = 'relay';
        this.waveStart = this.time;
        this.emit({ t: 'moment', text: 'FIRST TO FIVE', intensity: 2 });
    }
    protected update(dt: number): void {
        this.ctx.hype.at(this.time);
        if (this.time >= 150) this.suddenDeath();
        if (this.phase === 'relay' && this.relay) {
            this.relay.step(this.time - this.waveStart, this.time, this.units,
                (team, x, y) => this.spawnUnit(team, x, y, GATE_Y.length, 'relay', 0, 0),
                unit => this.remove(unit), (_team, count) => this.sound.pass(count));
            updateCascadeHud(this);
            if (this.relay.winner) {
                this.phase = 'complete';
                this.complete({ kind: 'team', teamId: this.relay.winner });
            }
            return;
        }
        if (this.phase === 'complete')
            return;
        const age = this.time - this.waveStart;
        this.board.step(age);
        this.collect();
        for (const unit of [...this.units.values()]) {
            const m = unit.marble;
            // A moving floor can leave a sleeping island suspended in Rapier. Wake it
            // without changing force, position or velocity; ordinary gravity does the rest.
            if (m.body.isSleeping())
                m.body.wakeUp();
            if (unit.stage < GATE_Y.length && m.y >= GATE_Y[unit.stage])
                this.multiply(unit);
            else if (m.y > COURSE.bottom + 100)
                this.remove(unit, true);
        }
        this.ctx.hud.setTeams(this.teams.map(team => ({ team, value: this.scores.get(team)! })));
        updateCascadeHud(this);
        if (age >= CLEAR_AT - 1.5 && !this.flushWarning && this.units.size) {
            this.flushWarning = true;
            this.ctx.hud.announce('FINAL RELEASE');
        }
        if (age >= EXPIRE_AT) {
            for (const unit of [...this.units.values()]) {
                this.stalls.push({ wave: this.wave, team: unit.marble.team, stage: unit.stage, x: unit.marble.x, y: unit.marble.y });
                this.expired++;
                this.remove(unit);
            }
            }
        if (!this.units.size)
            this.finishDrop();
    }
    protected ranking() {
        return this.teams.map(teamId => ({ teamId, score: this.relay?.finished.get(teamId) ?? 0,
            stat: `${this.relay?.finished.get(teamId) ?? 0} / ${RELAY_GOAL} FINISHERS` }));
    }
    protected finish(): Winner {
        return this.relay?.winner ? { kind: 'team', teamId: this.relay.winner }
            : { kind: 'void', reason: 'The relay has not been decided' };
    }
    protected draw(g: Graphics): void {
        // Keep the empty scoring frame visible while the camera pans to the finish.
        this.board.draw(g, this.time - (this.relay ? 0 : this.waveStart));
        if (this.relay) this.relay.draw(g);
    }
    step(dt: number): void {
        super.step(dt);
        this.ctx.camera.follow({ x: 960, y: this.camera.step(this.marbles, dt, this.phase !== 'drop') }, 1);
        if (!this.ctx.headless) {
            for (const marble of this.marbles) if (marble.alive) rememberTrail(marble.trail, marble.x, marble.y);
        }
    }

    render(alpha: number): void {
        if (this.graphics) {
            this.graphics.clear();
            this.draw(this.graphics);
        }
        this.view?.render(this, alpha);
    }

    suddenDeath(): void {
        if (this.sudden || this.result) return;
        this.sudden = true;
        if (this.relay) this.relay.sudden = true;
        this.emit({ t: 'moment', text: 'SUDDEN DEATH', intensity: 3 });
    }

    /** Stable team ordinals expose the actual score margin; teams never die. */
    takeState(): number[] {
        if (this.relay) return this.teams.map(team => this.relay!.finished.get(team)! / RELAY_GOAL * 6);
        const maximum = Math.max(1, ...this.scores.values());
        return this.teams.map(team => this.scores.get(team)! / maximum * 6);
    }

    protected debugInfo() {
        return cascadeInspection(this, this.drops.reduce((sum, drop) => sum + drop.expired, 0)
            + (this.phase === 'drop' ? this.expired : 0));
    }

    destroy(): void {
        this.relay?.destroy();
        this.view?.destroy();
        super.destroy();
    }
}
const definition: GameDefinition = {
    ...defineEvent('multiplier-cascade', ctx => new MultiplierCascade(ctx)),
    ending: 'natural',
    predictionTitle: () => 'Cascade: which team gets five finishers first?',
    formats: ['faction'], presentation: 'minimal', camera: 'scroll', cameraZoom: 1,
    scoreTake: scoreCascadeTake, supportsModifiers: []
};
export default definition;
