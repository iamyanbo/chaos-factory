import { expect, test } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Profiles } from '../../apps/server/src/profiles';
import { JsonStore } from '../../apps/server/src/storage';
import { messageSchema, newViewerProfile, type CupRoundRecord } from '@chaos/shared';

test('profiles survive a server restart, deduplicate awards, unlock titles and preserve the crown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chaos-profiles-'));
  try {
    const store = new JsonStore(root);
    const profiles = new Profiles(store);
    await profiles.load();
    const user = { userId: '123', login: 'neon_fox', displayName: 'NeonFox' };
    const originalColor = profiles.ensure(user).color;
    const record: CupRoundRecord = { cupId: randomUUID(), round: 1, final: false,
      awards: [{ ...user, place: 1, points: 10, won: true, reason: 'PLACE 1' }] };
    const first = randomUUID();
    await profiles.record('ring-escape', first, record);
    await profiles.record('ring-escape', first, record);
    await profiles.record('ring-escape', randomUUID(), { ...record, round: 2 });
    await profiles.record('ring-escape', randomUUID(), { ...record, round: 3 });
    expect(profiles.snapshot().users['123']).toMatchObject({ wins: 3, xp: 30, title: 'Ring Runner', level: 2 });
    await profiles.record('blade-brawl', randomUUID(), { ...record, round: 5, final: true, championId: '123' });
    const reloaded = new Profiles(store);
    await reloaded.load();
    expect(reloaded.snapshot().users['123']).toMatchObject({ color: originalColor, wins: 4, cupsWon: 1,
      xp: 40, level: 3, title: 'Cup Champion' });
    expect(reloaded.snapshot().crownUserId).toBe('123');
    expect(messageSchema.safeParse(reloaded.snapshot()).success).toBe(true);
    expect(await readFile(join(root, 'profiles.json'), 'utf8')).toContain('Cup Champion');
    const saved = JSON.parse(await readFile(join(root, 'profiles.json'), 'utf8'));
    saved.users['123'].receivedAt = 1000;
    saved.users['123'].legacyChatPayload = ['discard'];
    await store.write('profiles.json', saved);
    const normalized = new Profiles(store);
    await normalized.load();
    expect(normalized.snapshot().users['123']).toEqual(reloaded.snapshot().users['123']);
    expect(normalized.snapshot().crownUserId).toBe('123');
    await normalized.save();
    const persisted = await readFile(join(root, 'profiles.json'), 'utf8');
    expect(persisted).not.toContain('legacyChatPayload');
    expect(persisted).not.toContain('receivedAt');
    const incoming = { ...user, receivedAt: 1000, transient: 'chat-only' };
    expect(newViewerProfile(incoming)).toEqual(newViewerProfile(user));
  } finally {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !basename(root).startsWith('chaos-profiles-')) throw new Error('Unsafe test cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
