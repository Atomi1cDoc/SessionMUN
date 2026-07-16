// Scoring rules + aggregation. Point values live in one place so a chair can
// reason about them. Categories map 1:1 to the Matrix columns (GSL, POI,
// Cauc, Time, Mot, RTR, WP, DR, ± = manual).
//
// Design: every floor-time category (GSL, Cauc, RTR, Time) is scored purely
// from actual speaking duration at one shared rate, so nothing stacks a flat
// "you spoke" bonus on top of a separate time bonus for the same speech.
// Non-time categories (Mot, WP, DR, POI, attendance, manual) reward distinct
// procedural/diplomatic actions and are calibrated relative to that same
// per-minute unit so no single action dominates the total.

import type { Delegate, ScoreEvent, ScoreCategory, RollCallStatus } from '../types';

export const POINTS = {
  motionPassed: 1,
  workingPaperSponsor: 3,
  draftResolutionSponsor: 5,
  attendancePresent: 1,
  attendancePresentVoting: 2,
  poiBonus: 1,
  poiPenalty: -1,
  yieldAcceptBonus: 0.2,
} as const;

/** 1 point per full minute spoken; any nonzero speaking time earns at least 1. */
export function timePointsForSeconds(seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

export function attendancePoints(status: RollCallStatus): number {
  if (status === 'presentVoting') return POINTS.attendancePresentVoting;
  if (status === 'present') return POINTS.attendancePresent;
  return 0;
}

/** Rounds to 1 decimal — guards against float drift when summing many stored
 *  points (e.g. several 0.2 yield-acceptance bonuses). Display-only; the raw
 *  stored ScoreEvent.points values are never mutated. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Column order for the Matrix view.
export const MATRIX_COLUMNS: { key: ScoreCategory | 'total'; label: string }[] = [
  { key: 'gsl', label: 'GSL' },
  { key: 'poi', label: 'POI' },
  { key: 'caucus', label: 'Cauc' },
  { key: 'time', label: 'Time' },
  { key: 'motion', label: 'Mot' },
  { key: 'rtr', label: 'RTR' },
  { key: 'wp', label: 'WP' },
  { key: 'dr', label: 'DR' },
  { key: 'manual', label: '±' },
  { key: 'total', label: 'Total' },
];

export interface MatrixRow {
  delegate: Delegate;
  cells: Record<ScoreCategory, number>;
  total: number;
}

const ZERO_CELLS = (): Record<ScoreCategory, number> => ({
  gsl: 0,
  caucus: 0,
  time: 0,
  motion: 0,
  rtr: 0,
  wp: 0,
  dr: 0,
  poi: 0,
  attendance: 0,
  manual: 0,
});

/**
 * Build one row per delegate. `attendance` is folded into the Total but shown
 * separately in the delegate detail view; it is not its own Matrix column, so
 * we surface it under the row total (and expose the raw cells for detail use).
 */
export function computeMatrix(
  delegates: Delegate[],
  scoreEvents: ScoreEvent[],
  opts: { munEventId: string; sessionId?: string } = { munEventId: '' },
): MatrixRow[] {
  const byDelegate = new Map<string, Record<ScoreCategory, number>>();
  for (const d of delegates) byDelegate.set(d.id, ZERO_CELLS());

  for (const ev of scoreEvents) {
    if (opts.munEventId && ev.munEventId !== opts.munEventId) continue;
    if (opts.sessionId && ev.sessionId !== opts.sessionId) continue;
    const cells = byDelegate.get(ev.delegateId);
    if (!cells) continue;
    cells[ev.category] += ev.points;
  }

  return delegates.map((delegate) => {
    const cells = byDelegate.get(delegate.id)!;
    for (const key of Object.keys(cells) as ScoreCategory[]) cells[key] = round1(cells[key]);
    const total = round1((Object.values(cells) as number[]).reduce((a, b) => a + b, 0));
    return { delegate, cells, total };
  });
}

export function delegateTotal(
  delegateId: string,
  scoreEvents: ScoreEvent[],
  munEventId?: string,
): number {
  return round1(
    scoreEvents
      .filter((e) => e.delegateId === delegateId && (!munEventId || e.munEventId === munEventId))
      .reduce((sum, e) => sum + e.points, 0),
  );
}
