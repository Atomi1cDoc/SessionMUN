// Combined persistence for the whole AppData.
//
// Implementation decision: localStorage has a ~5MB ceiling, and the two slices
// that grow without bound across an 8-9 session event are `scoreEvents` and
// `comments` (long score/comment history). Those two are offloaded to
// IndexedDB via idb-keyval; the lighter, bounded slices (events + sessions +
// chairName) stay in localStorage as the primary store. This keeps us from
// silently hitting the quota ceiling on a long tournament.

import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { storage } from './storage';
import type { AppData, ScoreEvent, Comment, MunEvent, Session } from '../types';
import { emptyAppData } from '../types';

const LS_EVENTS = 'events';
const LS_SESSIONS = 'sessions';
const LS_CHAIR = 'chairName';
const IDB_SCORES = 'sessionmun:v1:scoreEvents';
const IDB_COMMENTS = 'sessionmun:v1:comments';

export async function loadAppData(): Promise<AppData> {
  const base = emptyAppData();
  const events = storage.get<MunEvent[]>(LS_EVENTS, base.events);
  const sessions = storage.get<Session[]>(LS_SESSIONS, base.sessions);
  const chairName = storage.get<string>(LS_CHAIR, base.chairName);

  let scoreEvents: ScoreEvent[] = [];
  let comments: Comment[] = [];
  try {
    scoreEvents = (await idbGet<ScoreEvent[]>(IDB_SCORES)) ?? [];
    comments = (await idbGet<Comment[]>(IDB_COMMENTS)) ?? [];
  } catch (err) {
    console.warn('[persistence] IndexedDB unavailable, falling back to localStorage', err);
    scoreEvents = storage.get<ScoreEvent[]>('scoreEvents', []);
    comments = storage.get<Comment[]>('comments', []);
  }

  return { version: 1, events, sessions, scoreEvents, comments, chairName };
}

export async function saveAppData(data: AppData): Promise<void> {
  storage.set(LS_EVENTS, data.events);
  storage.set(LS_SESSIONS, data.sessions);
  storage.set(LS_CHAIR, data.chairName);
  try {
    await idbSet(IDB_SCORES, data.scoreEvents);
    await idbSet(IDB_COMMENTS, data.comments);
  } catch (err) {
    console.warn('[persistence] IndexedDB write failed, using localStorage fallback', err);
    storage.set('scoreEvents', data.scoreEvents);
    storage.set('comments', data.comments);
  }
}

export async function clearAllData(): Promise<void> {
  storage.remove(LS_EVENTS);
  storage.remove(LS_SESSIONS);
  storage.remove(LS_CHAIR);
  storage.remove('scoreEvents');
  storage.remove('comments');
  try {
    await idbDel(IDB_SCORES);
    await idbDel(IDB_COMMENTS);
  } catch {
    /* ignore */
  }
}

// ---- JSON backup / restore (safety net for a purely-local app) ----

export function exportAppData(data: AppData): string {
  return JSON.stringify({ ...data, exportedAt: Date.now() }, null, 2);
}

export function parseImportedData(raw: string): AppData {
  const parsed = JSON.parse(raw);
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.events)) {
    throw new Error('Not a valid SessionMUN backup file.');
  }
  const base = emptyAppData();
  return {
    version: 1,
    events: parsed.events ?? base.events,
    sessions: parsed.sessions ?? base.sessions,
    scoreEvents: parsed.scoreEvents ?? base.scoreEvents,
    comments: parsed.comments ?? base.comments,
    chairName: parsed.chairName ?? base.chairName,
  };
}
