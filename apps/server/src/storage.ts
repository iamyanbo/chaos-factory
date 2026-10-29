import { mkdir, readFile, readdir, rename, writeFile, unlink, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
export class JsonStore {
  private pending: Promise<void> = Promise.resolve();
  constructor(readonly root: string) {}
  async read<T>(name: string, fallback: T): Promise<T> {
    try { return JSON.parse(await readFile(join(this.root, name), 'utf8')) as T; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`Could not read ${name}; using defaults`); return fallback; }
  }
  write(name: string, data: unknown): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    const job = this.pending.then(async () => {
      const path = join(this.root, name); await mkdir(dirname(path), { recursive: true });
      await writeFile(`${path}.tmp`, json, { encoding: 'utf8', mode: 0o600 }); await rename(`${path}.tmp`, path);
    });
    this.pending = job.catch(e => console.error('Persistence failed', e)); return job;
  }
  async trimReplays():Promise<void>{const dir=join(this.root,'replays');const names=(await readdir(dir)).filter(n=>/^[a-z0-9-]+-\d+(?:-[a-f0-9-]{36})?\.json$/i.test(n));const rows=await Promise.all(names.map(async name=>({name,at:(await stat(join(dir,name))).mtimeMs})));rows.sort((a,b)=>b.at-a.at);for(const row of rows.slice(20))await unlink(join(dir,row.name));}
}
