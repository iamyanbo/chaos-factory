import type { GameDefinition } from '../games/contract';
import './game-queue.css';

const SCROLL_EDGE = 72;
const SCROLL_SPEED = 16;
const MOVE_MS = 140;

interface Drag {
  pointer: number;
  row: HTMLLIElement;
  ghost: HTMLLIElement;
  offset: number;
  y: number;
}

export class GameQueue {
  private ids: string[] = [];
  private drag?: Drag;
  private frame = 0;
  private announcement = document.createElement('span');
  private help: HTMLElement;

  constructor(private list: HTMLOListElement, private empty: HTMLElement,
    private clearButton: HTMLButtonElement, private games: readonly GameDefinition[],
    private changed: (ids: string[]) => void) {
    this.announcement.className = 'visually-hidden';
    this.announcement.setAttribute('role', 'status');
    this.announcement.setAttribute('aria-live', 'polite');
    this.list.after(this.announcement);
    this.help = document.getElementById('queue-instructions')!;
    this.list.setAttribute('aria-label', 'Upcoming games');
    this.list.setAttribute('aria-describedby', 'queue-instructions');
    this.list.onpointermove = event => this.move(event);
    this.list.onpointerup = event => { if (event.pointerId === this.drag?.pointer) this.finish(); };
    this.list.onpointercancel = () => this.cancel();
    this.list.onlostpointercapture = () => { if (this.drag) this.cancel(); };
    this.list.onkeydown = event => {
      if (event.key === 'Escape' && this.drag) { event.preventDefault(); this.cancel(); }
    };
    this.clearButton.onclick = () => { this.cancel(); this.commit([]); };
    this.render();
  }

  set(ids: readonly string[]): void {
    if (JSON.stringify(ids) === JSON.stringify(this.ids)) return;
    this.cancel();
    this.ids = [...ids];
    this.render();
  }

  add(id: string): void { this.cancel(); this.commit([...this.ids, id]); }

  private title(id: string): string { return this.games.find(game => game.id === id)?.title ?? id; }

  private commit(ids: string[], focus?: number): void {
    this.ids = ids;
    this.render();
    if (focus !== undefined) this.list.children[focus]?.querySelector<HTMLButtonElement>('.queue-grip')?.focus();
    this.changed([...this.ids]);
  }

  private render(): void {
    this.list.replaceChildren(...this.ids.map((id, index) => {
      const row = document.createElement('li');
      row.className = 'queue-row';
      row.dataset.queueIndex = String(index);
      row.dataset.game = id;
      const title = this.title(id);
      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'queue-grip';
      grip.setAttribute('aria-label', `Move ${title}, position ${index + 1}`);
      grip.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown Home End');
      grip.title = 'Drag to reorder. Use arrow keys when focused.';
      grip.innerHTML = '<span class="grip-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
      grip.onkeydown = event => this.key(event, index);
      const preview = document.createElement('img');
      preview.src = `/game-previews/${id}.webp`;
      preview.alt = '';
      preview.width = 44;
      preview.height = 44;
      preview.draggable = false;
      const name = document.createElement('span');
      name.className = 'queue-title';
      name.textContent = title;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'queue-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${title}`);
      remove.title = 'Remove game';
      remove.onclick = () => { this.cancel(); this.commit(this.ids.filter((_, position) => position !== index)); };
      row.append(grip, preview, name, remove);
      row.onpointerdown = event => this.begin(event, row);
      return row;
    }));
    this.empty.hidden = this.ids.length > 0;
    this.clearButton.hidden = this.ids.length === 0;
    this.help.hidden = this.ids.length < 2;
  }

  private key(event: KeyboardEvent, index: number): void {
    let target = index;
    if (event.key === 'ArrowUp') target--;
    else if (event.key === 'ArrowDown') target++;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = this.ids.length - 1;
    else return;
    event.preventDefault();
    if (this.drag || target < 0 || target >= this.ids.length || target === index) return;
    const next = [...this.ids];
    const [id] = next.splice(index, 1);
    next.splice(target, 0, id);
    this.commit(next, target);
    this.announcement.textContent = `${this.title(id)} moved to position ${target + 1}.`;
  }

  private begin(event: PointerEvent, row: HTMLLIElement): void {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || this.drag || target.closest('.queue-remove')) return;
    if (event.pointerType === 'touch' && !target.closest('.queue-grip')) return;
    event.preventDefault();
    row.querySelector<HTMLButtonElement>('.queue-grip')!.focus();
    const box = row.getBoundingClientRect();
    const ghost = row.cloneNode(true) as HTMLLIElement;
    ghost.classList.add('queue-drag-preview');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    Object.assign(ghost.style, { width: `${box.width}px`, left: `${box.left}px`, top: `${box.top}px` });
    document.body.append(ghost);
    this.drag = { pointer: event.pointerId, row, ghost, offset: event.clientY - box.top, y: event.clientY };
    row.classList.add('queue-placeholder');
    this.list.classList.add('queue-dragging');
    this.list.setPointerCapture(event.pointerId);
    this.scroll();
  }

  private move(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointer) return;
    this.drag.y = event.clientY;
    const top = Math.max(8, Math.min(innerHeight - this.drag.ghost.offsetHeight - 8, event.clientY - this.drag.offset));
    this.drag.ghost.style.top = `${top}px`;
    this.place(event.clientY);
  }

  private place(y: number): void {
    if (!this.drag) return;
    const rows = [...this.list.children] as HTMLLIElement[];
    const row = this.drag.row;
    const top = this.list.getBoundingClientRect().top;
    const target = rows.find(item => item !== row && y < top + item.offsetTop + item.offsetHeight / 2) ?? null;
    if (row.nextElementSibling === target) return;
    const positions = new Map(rows.map(item => [item, item.getBoundingClientRect().top]));
    this.list.insertBefore(row, target);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const item of rows.filter(item => item !== row)) {
        const distance = positions.get(item)! - item.getBoundingClientRect().top;
        if (distance) item.animate([{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }],
          { duration: MOVE_MS, easing: 'ease-out' });
      }
    }
  }

  private scroll = (): void => {
    if (!this.drag) return;
    const { y } = this.drag;
    const distance = y < SCROLL_EDGE ? -SCROLL_SPEED : y > innerHeight - SCROLL_EDGE ? SCROLL_SPEED : 0;
    if (distance) { window.scrollBy(0, distance); this.place(y); }
    this.frame = requestAnimationFrame(this.scroll);
  };

  private release(): Drag | undefined {
    const drag = this.drag;
    this.drag = undefined;
    cancelAnimationFrame(this.frame);
    drag?.ghost.remove();
    drag?.row.classList.remove('queue-placeholder');
    this.list.classList.remove('queue-dragging');
    if (drag && this.list.hasPointerCapture(drag.pointer)) this.list.releasePointerCapture(drag.pointer);
    return drag;
  }

  private finish(): void {
    const drag = this.release();
    if (!drag) return;
    const rows = [...this.list.children] as HTMLLIElement[];
    const next = rows.map(row => this.ids[Number(row.dataset.queueIndex)]);
    const index = rows.indexOf(drag.row);
    this.commit(next, index);
    this.announcement.textContent = `${this.title(next[index])} moved to position ${index + 1}.`;
  }

  private cancel(): void { if (this.release()) this.render(); }
  destroy(): void { this.release(); }
}
