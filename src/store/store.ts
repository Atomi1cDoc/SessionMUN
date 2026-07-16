// Central app store. In-memory state is the source of truth; persistence is a
// debounced side effect. Exposes a `useStore` selector hook built on
// useSyncExternalStore. No external state library — the surface is small and
// explicit so the score/session logic stays auditable.

import { useRef, useSyncExternalStore } from 'react';
import type {
  AppData,
  MunEvent,
  Session,
  Delegate,
  ScoreEvent,
  ScoreCategory,
  Comment,
  Motion,
  MotionType,
  Vote,
  VotingType,
  RequiredMajority,
  BallotChoice,
  SingleSpeakerType,
  RollCallStatus,
  CaucusState,
} from '../types';
import { emptyAppData } from '../types';
import { loadAppData, saveAppData } from '../lib/persistence';
import { cookies, ACTIVE_EVENT_COOKIE } from '../lib/cookies';
import { uid, romanLabel } from '../lib/util';
import {
  POINTS,
  timePointsForSeconds,
  attendancePoints,
} from '../lib/scoring';

/** How a GSL speaker yielded the floor when their turn ended. Yielding to
 *  another delegate is handled separately (see `yieldGslToOther` /
 *  `finishGslGuest`) since it hands the live timer off mid-turn rather than
 *  concluding the current queue entry outright. */
export type GslYield = { type: 'poi'; result: 1 | -1 };

export type Route =
  | { name: 'setup' }
  | { name: 'home'; eventId: string }
  | { name: 'session'; sessionId: string; readOnly: boolean }
  | { name: 'review'; sessionId: string };

export type ScoreboardView = 'ranking' | 'matrix';

export interface UIState {
  route: Route;
  hydrated: boolean;
  scoreboard: {
    open: boolean;
    view: ScoreboardView;
    delegateId: string | null; // when set, delegate detail is shown
  };
}

export interface StoreState {
  data: AppData;
  ui: UIState;
}

let state: StoreState = {
  data: emptyAppData(),
  ui: {
    route: { name: 'setup' },
    hydrated: false,
    scoreboard: { open: false, view: 'ranking', delegateId: null },
  },
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): StoreState {
  return state;
}

// ---- persistence (debounced; only writes changed slices) ----
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (!state.ui.hydrated) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveAppData(state.data);
  }, 400);
}

/** Replace state.data via an updater and notify + persist. */
function update(mut: (data: AppData) => void, persist = true) {
  const draft = structuredCloneSafe(state.data);
  mut(draft);
  state = { ...state, data: draft };
  emit();
  if (persist) schedulePersist();
}

function updateUI(mut: (ui: UIState) => UIState) {
  state = { ...state, ui: mut(state.ui) };
  emit();
}

function structuredCloneSafe<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}

// ---- helpers ----
function findEvent(data: AppData, id: string): MunEvent | undefined {
  return data.events.find((e) => e.id === id);
}
function findSession(data: AppData, id: string): Session | undefined {
  return data.sessions.find((s) => s.id === id);
}

/** A session counts as reviewed once every roster delegate has at least one comment on it. */
export function isSessionFullyReviewed(data: AppData, session: Session): boolean {
  const event = findEvent(data, session.munEventId);
  if (!event) return true;
  return event.roster.every((d) => data.comments.some((c) => c.sessionId === session.id && c.delegateId === d.id));
}

function findUnreviewedEndedSession(data: AppData, eventId: string): Session | undefined {
  return data.sessions.find(
    (s) => s.munEventId === eventId && s.status === 'ended' && !isSessionFullyReviewed(data, s),
  );
}

function pushScore(
  data: AppData,
  ev: Omit<ScoreEvent, 'id' | 'createdAt'> & { createdAt?: number },
) {
  // Dedupe auto events by sourceRef so re-triggering an action doesn't double-award.
  if (ev.sourceRef && data.scoreEvents.some((e) => e.sourceRef === ev.sourceRef)) return;
  data.scoreEvents.push({
    ...ev,
    id: uid('sc'),
    createdAt: ev.createdAt ?? Date.now(),
  });
}

// ===========================================================================
// Public actions
// ===========================================================================

export const actions = {
  async hydrate() {
    const data = await loadAppData();
    let route: Route = { name: 'setup' };
    const activeId = cookies.get(ACTIVE_EVENT_COOKIE);
    const targetEventId = activeId && data.events.some((e) => e.id === activeId)
      ? activeId
      : data.events[0]?.id;
    if (targetEventId) {
      const unreviewed = findUnreviewedEndedSession(data, targetEventId);
      route = unreviewed ? { name: 'review', sessionId: unreviewed.id } : { name: 'home', eventId: targetEventId };
    }
    state = { data, ui: { ...state.ui, route, hydrated: true } };
    emit();
  },

  // ---- navigation ----
  go(route: Route) {
    if (route.name === 'home') {
      const unreviewed = findUnreviewedEndedSession(state.data, route.eventId);
      cookies.set(ACTIVE_EVENT_COOKIE, route.eventId);
      if (unreviewed) {
        updateUI((ui) => ({ ...ui, route: { name: 'review', sessionId: unreviewed.id } }));
        return;
      }
    }
    updateUI((ui) => ({ ...ui, route }));
  },
  goSetup() {
    updateUI((ui) => ({ ...ui, route: { name: 'setup' } }));
  },
  openScoreboard(delegateId: string | null = null) {
    updateUI((ui) => ({
      ...ui,
      scoreboard: { ...ui.scoreboard, open: true, delegateId },
    }));
  },
  closeScoreboard() {
    updateUI((ui) => ({ ...ui, scoreboard: { ...ui.scoreboard, open: false, delegateId: null } }));
  },
  setScoreboardView(view: ScoreboardView) {
    updateUI((ui) => ({ ...ui, scoreboard: { ...ui.scoreboard, view } }));
  },
  viewDelegate(delegateId: string | null) {
    updateUI((ui) => ({ ...ui, scoreboard: { ...ui.scoreboard, delegateId } }));
  },

  setChairName(name: string) {
    update((d) => {
      d.chairName = name.trim() || 'Chair';
    });
  },

  // ---- setup / events ----
  createEvent(input: { name: string; logoEmoji?: string; roster: Delegate[] }): string {
    const id = uid('evt');
    update((d) => {
      d.events.push({
        id,
        name: input.name.trim() || 'Your Committee',
        logoEmoji: input.logoEmoji,
        createdAt: Date.now(),
        roster: input.roster,
        sessionIds: [],
        status: 'active',
      });
    });
    cookies.set(ACTIVE_EVENT_COOKIE, id);
    updateUI((ui) => ({ ...ui, route: { name: 'home', eventId: id } }));
    return id;
  },

  updateRoster(eventId: string, roster: Delegate[]) {
    update((d) => {
      const ev = findEvent(d, eventId);
      if (ev) ev.roster = roster;
    });
  },

  deleteEvent(eventId: string) {
    update((d) => {
      d.events = d.events.filter((e) => e.id !== eventId);
      d.sessions = d.sessions.filter((s) => s.munEventId !== eventId);
      d.scoreEvents = d.scoreEvents.filter((s) => s.munEventId !== eventId);
      d.comments = d.comments.filter((c) => c.munEventId !== eventId);
    });
  },

  /** Ends the whole committee. Data (roster, sessions, scores, comments) is kept —
   *  only Start/Resume Session is locked out; Scoreboard/export stay available. */
  endEvent(eventId: string) {
    let forcedSessionId: string | null = null;
    update((d) => {
      const ev = findEvent(d, eventId);
      if (!ev) return;
      ev.status = 'ended';
      ev.endedAt = Date.now();
      for (const s of d.sessions) {
        if (s.munEventId === eventId && s.status === 'inProgress') {
          s.status = 'ended';
          s.endedAt = Date.now();
          if (s.modState) s.modState.status = 'ended';
          if (s.unmodState) s.unmodState.status = 'ended';
          forcedSessionId = s.id;
        }
      }
    });
    if (forcedSessionId) {
      updateUI((ui) => ({ ...ui, route: { name: 'review', sessionId: forcedSessionId! } }));
    }
  },

  // ---- sessions ----
  startSession(eventId: string): string {
    const id = uid('ses');
    update((d) => {
      const ev = findEvent(d, eventId);
      if (!ev) return;
      const label = `Session ${romanLabel(ev.sessionIds.length)}`;
      const session: Session = {
        id,
        munEventId: eventId,
        label,
        status: 'inProgress',
        startedAt: Date.now(),
        rollCall: {},
        rollCallDone: false,
        gslQueue: [],
        gslPerSpeakerSeconds: 60,
        modState: null,
        unmodState: null,
        singleSpeakerLog: [],
        motions: [],
        votes: [],
      };
      d.sessions.push(session);
      ev.sessionIds.push(id);
    });
    updateUI((ui) => ({ ...ui, route: { name: 'session', sessionId: id, readOnly: false } }));
    return id;
  },

  openSession(sessionId: string, readOnly: boolean) {
    updateUI((ui) => ({ ...ui, route: { name: 'session', sessionId, readOnly } }));
  },

  /** Ending a session always drops the chair into forced Review Mode — Home is
   *  unreachable again (see `go`/`hydrate`) until every delegate has a comment. */
  endSession(sessionId: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (s) {
        s.status = 'ended';
        s.endedAt = Date.now();
        if (s.modState) s.modState.status = 'ended';
        if (s.unmodState) s.unmodState.status = 'ended';
      }
    });
    updateUI((ui) => ({ ...ui, route: { name: 'review', sessionId } }));
  },

  setAgenda(sessionId: string, agenda: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (s) s.agendaItem = agenda.trim() || undefined;
    });
  },

  // ---- roll call ----
  setRollCall(sessionId: string, delegateId: string, status: RollCallStatus) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (s) s.rollCall[delegateId] = status;
    });
  },

  completeRollCall(sessionId: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      s.rollCallDone = true;
      // Award attendance points once per (session, delegate).
      for (const [delegateId, status] of Object.entries(s.rollCall)) {
        const pts = attendancePoints(status);
        if (pts > 0) {
          pushScore(d, {
            munEventId: s.munEventId,
            sessionId: s.id,
            delegateId,
            category: 'attendance',
            points: pts,
            reason: status === 'presentVoting' ? 'Present & Voting' : 'Present',
            sourceRef: `attend:${s.id}:${delegateId}`,
          });
        }
      }
    });
  },

  // ---- GSL ----
  setGslPerSpeaker(sessionId: string, seconds: number) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (s) s.gslPerSpeakerSeconds = Math.max(5, seconds);
    });
  },

  addGslSpeaker(sessionId: string, delegateId: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s || !s.rollCallDone) return;
      if (s.gslQueue.some((e) => e.delegateId === delegateId && e.status !== 'spoken')) return;
      const anySpeaking = s.gslQueue.some((e) => e.status === 'speaking');
      s.gslQueue.push({
        id: uid('sp'),
        delegateId,
        status: anySpeaking ? 'queued' : s.gslQueue.length === 0 ? 'speaking' : 'queued',
        order: s.gslQueue.length,
      });
    });
  },

  removeGslSpeaker(sessionId: string, entryId: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (s) s.gslQueue = s.gslQueue.filter((e) => e.id !== entryId);
    });
  },

  /** Swaps a queued speaker with the one immediately above/below it in the Upcoming list. */
  moveGslSpeaker(sessionId: string, entryId: string, direction: 'up' | 'down') {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      const queuedIndices = s.gslQueue
        .map((e, i) => (e.status === 'queued' ? i : -1))
        .filter((i) => i !== -1);
      const pos = queuedIndices.findIndex((i) => s.gslQueue[i].id === entryId);
      if (pos === -1) return;
      const swapPos = direction === 'up' ? pos - 1 : pos + 1;
      if (swapPos < 0 || swapPos >= queuedIndices.length) return;
      const a = queuedIndices[pos];
      const b = queuedIndices[swapPos];
      [s.gslQueue[a], s.gslQueue[b]] = [s.gslQueue[b], s.gslQueue[a]];
    });
  },

  /**
   * Advance GSL: current speaker -> spoken (awarded purely from speaking time,
   * no separate flat bonus), next queued -> speaking. `gslYield` reflects how
   * the delegate yielded: POI (+1/-1 for how well they handled it), yielding
   * to another delegate who accepts (that delegate earns a small acceptance
   * bonus plus normal time-based credit for however long they then spoke), or
   * omitted if they yielded to the Chair or declined/no one accepted.
   */
  nextGslSpeaker(sessionId: string, secondsSpoken?: number, gslYield?: GslYield) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      const current = s.gslQueue.find((e) => e.status === 'speaking');
      if (current) {
        current.status = 'spoken';
        const secs = secondsSpoken ?? s.gslPerSpeakerSeconds;
        current.secondsSpoken = secs;
        const pts = timePointsForSeconds(secs);
        if (pts > 0) {
          pushScore(d, {
            munEventId: s.munEventId,
            sessionId: s.id,
            delegateId: current.delegateId,
            category: 'gsl',
            points: pts,
            reason: `GSL floor time (${secs}s)`,
            sourceRef: `gsl:${current.id}`,
          });
        }
        if (gslYield?.type === 'poi') {
          pushScore(d, {
            munEventId: s.munEventId,
            sessionId: s.id,
            delegateId: current.delegateId,
            category: 'poi',
            points: gslYield.result > 0 ? POINTS.poiBonus : POINTS.poiPenalty,
            reason: gslYield.result > 0 ? 'Handled points of information well' : 'Struggled with points of information',
            sourceRef: `poi:${current.id}`,
          });
        }
      }
      const next = s.gslQueue.find((e) => e.status === 'queued');
      if (next) next.status = 'speaking';
    });
  },

  /**
   * X yields mid-turn to another delegate who accepts the floor: scores X for
   * their partial turn and marks their queue entry spoken, but does *not*
   * promote the next queued speaker — the accepting delegate borrows the rest
   * of the live timer instead. They get a small acceptance bonus immediately;
   * their actual floor time is credited later via `finishGslGuest` once their
   * segment ends, at which point the caller should also call
   * `nextGslSpeaker(sessionId)` (with no args) to promote the real next speaker.
   */
  yieldGslToOther(sessionId: string, secondsSpokenByCurrent: number, toDelegateId: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      const current = s.gslQueue.find((e) => e.status === 'speaking');
      if (!current) return;
      current.status = 'spoken';
      current.secondsSpoken = secondsSpokenByCurrent;
      const pts = timePointsForSeconds(secondsSpokenByCurrent);
      if (pts > 0) {
        pushScore(d, {
          munEventId: s.munEventId,
          sessionId: s.id,
          delegateId: current.delegateId,
          category: 'gsl',
          points: pts,
          reason: `GSL floor time (${secondsSpokenByCurrent}s)`,
          sourceRef: `gsl:${current.id}`,
        });
      }
      pushScore(d, {
        munEventId: s.munEventId,
        sessionId: s.id,
        delegateId: toDelegateId,
        category: 'gsl',
        points: POINTS.yieldAcceptBonus,
        reason: 'Accepted a yield from another delegate',
        sourceRef: `gslyieldaccept:${current.id}`,
      });
    });
  },

  /** Credits the floor time a delegate used after accepting a yield (see `yieldGslToOther`). */
  finishGslGuest(sessionId: string, delegateId: string, secondsSpoken: number) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      const pts = timePointsForSeconds(secondsSpoken);
      if (pts > 0) {
        pushScore(d, {
          munEventId: s.munEventId,
          sessionId: s.id,
          delegateId,
          category: 'gsl',
          points: pts,
          reason: `Floor time via yield (${secondsSpoken}s)`,
          sourceRef: `gslguest:${uid('g')}`,
        });
      }
    });
  },

  // ---- motions ----
  addMotion(
    sessionId: string,
    input: {
      type: MotionType;
      label: string;
      proposedBy: string;
      totalSeconds?: number;
      perSpeakerSeconds?: number;
    },
  ) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      const motion: Motion = {
        id: uid('mo'),
        type: input.type,
        label: input.label,
        proposedBy: input.proposedBy,
        seconds: [],
        result: 'pending',
        totalSeconds: input.totalSeconds,
        perSpeakerSeconds: input.perSpeakerSeconds,
        createdAt: Date.now(),
      };
      s.motions.unshift(motion);
    });
  },

  toggleMotionSecond(sessionId: string, motionId: string, delegateId: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      const m = s?.motions.find((x) => x.id === motionId);
      if (!m) return;
      m.seconds = m.seconds.includes(delegateId)
        ? m.seconds.filter((x) => x !== delegateId)
        : [...m.seconds, delegateId];
    });
  },

  setMotionResult(sessionId: string, motionId: string, result: 'passed' | 'failed' | 'pending') {
    update((d) => {
      const s = findSession(d, sessionId);
      const m = s?.motions.find((x) => x.id === motionId);
      if (!s || !m) return;
      m.result = result;
      // Award the proposer for a passed motion (Mot column).
      if (result === 'passed') {
        pushScore(d, {
          munEventId: s.munEventId,
          sessionId: s.id,
          delegateId: m.proposedBy,
          category: 'motion',
          points: POINTS.motionPassed,
          reason: `Motion passed: ${m.label}`,
          sourceRef: `motion:${m.id}`,
        });
      }
    });
  },

  removeMotion(sessionId: string, motionId: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (s) s.motions = s.motions.filter((m) => m.id !== motionId);
    });
  },

  // ---- caucus (mod / unmod share this shape) ----
  configureCaucus(
    sessionId: string,
    which: 'mod' | 'unmod',
    input: { topic?: string; totalSeconds: number; perSpeakerSeconds?: number },
  ) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      const caucus: CaucusState = {
        id: uid('cau'),
        topic: input.topic,
        totalSeconds: input.totalSeconds,
        perSpeakerSeconds: input.perSpeakerSeconds,
        remainingSeconds: input.totalSeconds,
        speakerQueue: which === 'mod' ? [] : undefined,
        status: 'paused',
      };
      if (which === 'mod') s.modState = caucus;
      else s.unmodState = caucus;
    });
  },

  setCaucusStatus(sessionId: string, which: 'mod' | 'unmod', status: CaucusState['status']) {
    update((d) => {
      const s = findSession(d, sessionId);
      const c = which === 'mod' ? s?.modState : s?.unmodState;
      if (c) c.status = status;
    });
  },

  setCaucusRemaining(sessionId: string, which: 'mod' | 'unmod', remaining: number) {
    update((d) => {
      const s = findSession(d, sessionId);
      const c = which === 'mod' ? s?.modState : s?.unmodState;
      if (c) c.remainingSeconds = Math.max(0, remaining);
    });
  },

  /**
   * Ending a moderated caucus is when its speeches actually score — a
   * delegate may hold the floor across several turns in one caucus, so we sum
   * their total speaking time here rather than awarding per-turn like GSL.
   */
  endCaucus(sessionId: string, which: 'mod' | 'unmod') {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      if (which === 'mod' && s.modState?.speakerQueue) {
        const c = s.modState;
        const totals = new Map<string, number>();
        for (const e of c.speakerQueue!) {
          if (e.status !== 'spoken') continue;
          const secs = e.secondsSpoken ?? c.perSpeakerSeconds ?? 45;
          totals.set(e.delegateId, (totals.get(e.delegateId) ?? 0) + secs);
        }
        for (const [delegateId, secs] of totals) {
          const pts = timePointsForSeconds(secs);
          if (pts > 0) {
            pushScore(d, {
              munEventId: s.munEventId,
              sessionId: s.id,
              delegateId,
              category: 'caucus',
              points: pts,
              reason: `Caucus floor time (${secs}s total)`,
              sourceRef: `caucdone:${c.id}:${delegateId}`,
            });
          }
        }
      }
      if (which === 'mod') s.modState = null;
      else s.unmodState = null;
    });
  },

  addCaucusSpeaker(sessionId: string, delegateId: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      const c = s?.modState;
      if (!s || !c) return;
      if (!c.speakerQueue) c.speakerQueue = [];
      if (c.speakerQueue.some((e) => e.delegateId === delegateId && e.status !== 'spoken')) return;
      const anySpeaking = c.speakerQueue.some((e) => e.status === 'speaking');
      c.speakerQueue.push({
        id: uid('csp'),
        delegateId,
        status: anySpeaking ? 'queued' : c.speakerQueue.length === 0 ? 'speaking' : 'queued',
        order: c.speakerQueue.length,
      });
    });
  },

  /** Marks the current caucus speaker done; scoring happens once on `endCaucus`. */
  nextCaucusSpeaker(sessionId: string, secondsSpoken?: number) {
    update((d) => {
      const s = findSession(d, sessionId);
      const c = s?.modState;
      if (!s || !c || !c.speakerQueue) return;
      const current = c.speakerQueue.find((e) => e.status === 'speaking');
      if (current) {
        current.status = 'spoken';
        current.secondsSpoken = secondsSpoken ?? c.perSpeakerSeconds ?? 45;
      }
      const next = c.speakerQueue.find((e) => e.status === 'queued');
      if (next) next.status = 'speaking';
    });
  },

  // ---- single speaker ----
  logSingleSpeaker(
    sessionId: string,
    input: { delegateId: string; type: SingleSpeakerType; seconds: number },
  ) {
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      const evId = uid('ss');
      s.singleSpeakerLog.unshift({
        id: evId,
        delegateId: input.delegateId,
        type: input.type,
        seconds: input.seconds,
        createdAt: Date.now(),
      });
      const isRTR = input.type === 'rightOfReply';
      const pts = timePointsForSeconds(input.seconds);
      if (pts > 0) {
        pushScore(d, {
          munEventId: s.munEventId,
          sessionId: s.id,
          delegateId: input.delegateId,
          category: isRTR ? 'rtr' : 'time',
          points: pts,
          reason: isRTR ? `Right of reply (${input.seconds}s)` : `Floor time (${input.seconds}s)`,
          sourceRef: `ss:${evId}`,
        });
      }
    });
  },

  // ---- votes ----
  createVote(
    sessionId: string,
    input: {
      votingType: VotingType;
      requiredMajority: RequiredMajority;
      label?: string;
      subjectKind?: Vote['subjectKind'];
      sponsors?: string[];
    },
  ): string {
    const id = uid('vote');
    update((d) => {
      const s = findSession(d, sessionId);
      if (!s) return;
      s.votes.unshift({
        id,
        label: input.label,
        votingType: input.votingType,
        requiredMajority: input.requiredMajority,
        ballots: {},
        resultsHidden: false,
        subjectKind: input.subjectKind ?? (input.votingType === 'procedural' ? 'procedural' : undefined),
        sponsors: input.sponsors ?? [],
        createdAt: Date.now(),
      });
    });
    return id;
  },

  setBallot(sessionId: string, voteId: string, delegateId: string, choice: BallotChoice) {
    update((d) => {
      const s = findSession(d, sessionId);
      const v = s?.votes.find((x) => x.id === voteId);
      if (!v) return;
      if (v.ballots[delegateId] === choice) delete v.ballots[delegateId];
      else v.ballots[delegateId] = choice;
    });
  },

  toggleVoteHidden(sessionId: string, voteId: string) {
    update((d) => {
      const s = findSession(d, sessionId);
      const v = s?.votes.find((x) => x.id === voteId);
      if (v) v.resultsHidden = !v.resultsHidden;
    });
  },

  setVoteSubject(sessionId: string, voteId: string, kind: Vote['subjectKind'], sponsors: string[]) {
    update((d) => {
      const s = findSession(d, sessionId);
      const v = s?.votes.find((x) => x.id === voteId);
      if (v) {
        v.subjectKind = kind;
        v.sponsors = sponsors;
      }
    });
  },

  closeVote(sessionId: string, voteId: string, outcome: 'passed' | 'failed') {
    update((d) => {
      const s = findSession(d, sessionId);
      const v = s?.votes.find((x) => x.id === voteId);
      if (!s || !v) return;
      v.outcome = outcome;
      v.closedAt = Date.now();
      // A passed substantive vote adopting a DR/WP credits its sponsors.
      if (outcome === 'passed' && v.sponsors && v.sponsors.length > 0) {
        if (v.subjectKind === 'draftResolution' || v.subjectKind === 'workingPaper') {
          const category: ScoreCategory = v.subjectKind === 'draftResolution' ? 'dr' : 'wp';
          const pts =
            v.subjectKind === 'draftResolution'
              ? POINTS.draftResolutionSponsor
              : POINTS.workingPaperSponsor;
          for (const sponsor of v.sponsors) {
            pushScore(d, {
              munEventId: s.munEventId,
              sessionId: s.id,
              delegateId: sponsor,
              category,
              points: pts,
              reason: `Sponsor of adopted ${v.subjectKind === 'draftResolution' ? 'draft resolution' : 'working paper'}`,
              sourceRef: `${category}:${v.id}:${sponsor}`,
            });
          }
        }
      }
    });
  },

  // ---- manual score adjustment ----
  addManualAdjustment(input: {
    munEventId: string;
    sessionId: string;
    delegateId: string;
    points: number; // signed
    reason: string;
  }) {
    update((d) => {
      pushScore(d, {
        munEventId: input.munEventId,
        sessionId: input.sessionId,
        delegateId: input.delegateId,
        category: 'manual',
        points: input.points,
        reason: input.reason,
        createdBy: d.chairName,
      });
    });
  },

  // ---- comments (post-session feature) ----
  addComment(input: {
    munEventId: string;
    sessionId: string;
    delegateId: string;
    text: string;
    rubric?: Comment['rubric'];
  }) {
    update((d) => {
      d.comments.push({
        id: uid('cm'),
        munEventId: input.munEventId,
        sessionId: input.sessionId,
        delegateId: input.delegateId,
        authorName: d.chairName,
        text: input.text.trim(),
        rubric: input.rubric,
        createdAt: Date.now(),
      });
    });
  },

  editComment(commentId: string, text: string, rubric?: Comment['rubric']) {
    update((d) => {
      const c = d.comments.find((x) => x.id === commentId);
      if (c) {
        c.text = text.trim();
        c.rubric = rubric ?? c.rubric;
        c.editedAt = Date.now();
      }
    });
  },

  deleteComment(commentId: string) {
    update((d) => {
      d.comments = d.comments.filter((c) => c.id !== commentId);
    });
  },

  // ---- import / reset ----
  replaceAll(data: AppData) {
    state = { ...state, data };
    emit();
    void saveAppData(data);
  },
};

// ---- selector hook ----
// Selectors frequently derive fresh arrays/objects (.filter, new Map). Raw
// useSyncExternalStore requires getSnapshot to return a *stable* reference while
// the store is unchanged, or it loops forever ("Maximum update depth exceeded").
// We cache the derived value keyed on (state ref, selector identity); both are
// constant within a single render + tearing-check window, so the snapshot stays
// stable, while any real state change (new state ref) recomputes it.
export function useStore<T>(selector: (s: StoreState) => T): T {
  const cache = useRef<{ state: StoreState | null; sel: ((s: StoreState) => T) | null; val: T }>({
    state: null,
    sel: null,
    val: undefined as T,
  });
  const getSnap = (): T => {
    const s = getSnapshot();
    const c = cache.current;
    if (c.state === s && c.sel === selector) return c.val;
    c.state = s;
    c.sel = selector;
    c.val = selector(s);
    return c.val;
  };
  return useSyncExternalStore(subscribe, getSnap, getSnap);
}

export function getState(): StoreState {
  return state;
}

// Convenience selectors
export function useActiveSession(sessionId: string): Session | undefined {
  return useStore((s) => s.data.sessions.find((x) => x.id === sessionId));
}
export function useEvent(eventId: string): MunEvent | undefined {
  return useStore((s) => s.data.events.find((x) => x.id === eventId));
}
