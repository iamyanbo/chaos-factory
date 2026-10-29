import { TEAMS } from '@chaos/shared';
import type { HudState } from '../hud/hud';
import { TOY, toyColor } from '../kit/theme/toy';

export interface ResultRow {
  id: string;
  name: string;
  color: number;
  rank?: number;
  value: string;
  detail: string;
  cupPoints?: number;
}
export interface ResultModel {
  name: string;
  color: number;
  label: string;
  stat: string;
  rowsTitle: string;
  rows: ResultRow[];
  winnerId?: string;
  cancelled: boolean;
  message?: string;
  note?: string;
}

const numeric = (value: number) => Number.isInteger(value) ? value.toLocaleString()
  : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const color = (value?: string) => value && /^#[0-9a-f]{6}$/i.test(value)
  ? toyColor(Number.parseInt(value.slice(1), 16)) : TOY.color.accentB;

function performance(id: string, score: number): string {
  if (id === 'peg-fever') return `${numeric(score)} pts`;
  if (id === 'blade-brawl') return `${numeric(score)} hits`;
  if (id === 'ring-escape') return `Ring ${numeric(score)}`;
  if (id === 'hot-potato' || id === 'light-cycles') return `${numeric(score)}s`;
  return numeric(score);
}

/** Presentation reads actual outcomes and awards; it never invents podium points. */
export function roundResult(state: HudState): ResultModel {
  const result = state.result;
  const show = state.show;
  const awards = show?.roundAwards ?? show?.podium ?? [];
  const cancelled = !result || result.winner.kind === 'void';
  if (cancelled) return { name: 'ROUND CANCELLED', color: TOY.color.muted,
    label: 'NO WINNER', stat: '', rowsTitle: 'NO RESULT', rows: [], cancelled: true,
    message: result?.winner.kind === 'void' ? result.winner.reason.slice(0, 180) : 'No result is available.' };
  const winner = result.winner;
  const champion = result.champion;
  const members = result.replay.setup?.participants ?? [];
  const championColor = members.find(member => member.userId === champion?.userId)?.color;
  let name = winner.kind === 'streamer' ? state.streamerName ?? 'Streamer' : champion?.displayName ?? 'CHAT';
  let winnerId = winner.kind === 'streamer' ? 'streamer' : champion?.userId ?? 'chat';
  let tint: number = winner.kind === 'streamer' ? TOY.color.accentB
    : !champion ? TOY.color.accentA : color(championColor);
  let rows: ResultRow[] = [];
  const collective = (!champion || winner.kind === 'streamer') && winner.kind !== 'team';
  let rowsTitle = collective ? state.game.id === 'blade-brawl' ? 'MOST HITS' : 'VIEWER RESULTS' : 'FINAL RESULTS';
  if (winner.kind === 'team') {
    name = state.game.teamNames?.[winner.teamId] ?? TEAMS[winner.teamId].name;
    winnerId = winner.teamId;
    tint = toyColor(TEAMS[winner.teamId].hex);
    const standings = result.standings ?? [...new Set(members.map(member => member.teamId).filter(Boolean))]
      .map(teamId => ({ teamId: teamId!, score: members.filter(member => member.teamId === teamId)
        .reduce((sum, member) => sum + (result.perUser[member.userId]?.score ?? 0), 0) }))
      .sort((a, b) => Number(b.teamId === winner.teamId) - Number(a.teamId === winner.teamId) || b.score - a.score)
      .map(row => ({ ...row, stat: performance(state.game.id, row.score) }));
    const ordered = [...standings].sort((a, b) => Number(b.teamId === winner.teamId) - Number(a.teamId === winner.teamId));
    rows = ordered.map((row, index) => ({ id: row.teamId,
      name: state.game.teamNames?.[row.teamId] ?? TEAMS[row.teamId].name,
      rank: index + 1, color: toyColor(TEAMS[row.teamId].hex), value: row.stat,
      detail: '' }));
    rowsTitle = 'TEAM RESULTS';
  } else if (show?.raceSummary?.podium.length) {
    rows = show.raceSummary.podium.map(row => ({ id: row.id, name: row.name,
      rank: row.place, color: state.participantColors?.[row.name] ?? TOY.color.accentA,
      value: `${row.time.toFixed(2)}s`, detail: 'FINISH TIME' }));
  } else {
    const entries = Object.entries(result.perUser).map(([id, entry]) => {
      const place = entry.tags.find(tag => tag.startsWith('place:'))?.slice(6);
      const award = awards.find(row => row.userId === id);
      return { id, score: entry.score, place: place ? Number(place) : undefined, award,
        name: state.participantNames?.[id] ?? members.find(member => member.userId === id)?.displayName
          ?? award?.displayName ?? id };
    });
    entries.sort((a, b) => collective ? b.score - a.score
      : Number(b.id === winnerId) - Number(a.id === winnerId)
        || (a.place ?? a.award?.place ?? Infinity) - (b.place ?? b.award?.place ?? Infinity)
        || b.score - a.score || a.id.localeCompare(b.id));
    rows = entries.slice(0, 5).map((entry, index) => ({ id: entry.id, name: entry.name,
      color: state.participantColors?.[entry.name] ?? color(members.find(member => member.userId === entry.id)?.color),
      rank: collective ? index + 1 : entry.place ?? entry.award?.place ?? (entry.id === winnerId ? 1 : undefined), value: performance(state.game.id, entry.score), detail: '' }));
  }
  if (!state.practice) for (const row of rows) {
    row.cupPoints = awards.find(award => award.userId === row.id)?.points;
  }
  const winningRow = rows.find(row => row.id === winnerId);
  const stat = winningRow?.value ?? (collective
    ? 'LAST SIDE STANDING'
    : champion?.reason ?? '');
  return { name, color: result.winnerColor === undefined ? tint : toyColor(result.winnerColor), winnerId, rows, rowsTitle, stat,
    note: show?.raceSummary ? `${show.raceSummary.finished} / ${show.raceSummary.total} marbles finished` : undefined,
    label: winner.kind === 'team' || collective ? 'WINNING SIDE' : 'ROUND WINNER', cancelled: false };
}


/** Grand Final victory, rather than Cup-point rank, decides the champion. */
export function cupResult(state: HudState): ResultModel {
  const show = state.show!;
  const champion = show.standings.find(row => row.userId === show.championId);
  const rows = show.standings.slice(0, 5);
  if (champion && !rows.includes(champion)) rows.push(champion);
  return { name: champion?.displayName ?? 'NO CHAMPION', label: champion ? 'CUP CHAMPION' : 'CUP COMPLETE',
    color: champion ? color(champion.color) : TOY.color.muted,
    stat: champion ? `${champion.points} CUP POINTS` : '', cancelled: !champion,
    message: champion ? undefined : 'The Grand Final did not produce a winner.',
    rowsTitle: 'CUP POINTS', winnerId: champion?.userId,
    rows: rows.map(row => ({ id: row.userId, name: row.displayName, rank: row.rank,
      color: color(row.color), value: `${row.points} pts`, detail: '' })) };
}
