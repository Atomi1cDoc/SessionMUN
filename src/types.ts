// ---------------------------------------------------------------------------
// Core data model for SessionMUN. All client-side; persisted under the
// namespaced key `sessionmun:v1` (localStorage) with the heavy score/comment
// slices offloaded to IndexedDB. See src/lib/persistence.ts.
// ---------------------------------------------------------------------------

export type RollCallStatus = 'present' | 'presentVoting' | 'absent';

export interface Delegate {
  id: string;
  countryName: string;
  countryCode: string; // ISO 3166-1 alpha-2 (uppercase) for UN states; short code for custom
  isCustom: boolean;
  flagEmoji?: string;
}

export interface SpeakerListEntry {
  id: string;
  delegateId: string;
  status: 'queued' | 'speaking' | 'spoken';
  order: number;
  secondsSpoken?: number;
}

export interface CaucusState {
  id: string;
  topic?: string;
  totalSeconds: number;
  perSpeakerSeconds?: number;
  remainingSeconds: number;
  speakerQueue?: SpeakerListEntry[];
  status: 'running' | 'paused' | 'ended';
}

export type SingleSpeakerType = 'rightOfReply' | 'personalPrivilege' | 'other';

export interface SingleSpeakerEvent {
  id: string;
  delegateId: string;
  type: SingleSpeakerType;
  seconds: number;
  createdAt: number;
}

export type MotionType =
  | 'moderatedCaucus'
  | 'unmoderatedCaucus'
  | 'introduceDraftResolution'
  | 'introduceWorkingPaper'
  | 'openDebate'
  | 'closeDebate'
  | 'suspendMeeting'
  | 'other';

export interface Motion {
  id: string;
  type: MotionType;
  label: string; // human readable, e.g. "10-min moderated caucus, 60s speeches"
  proposedBy: string; // delegateId
  seconds: string[]; // delegateId[]
  result: 'pending' | 'passed' | 'failed';
  // Optional caucus config carried by moderated/unmoderated motions
  totalSeconds?: number;
  perSpeakerSeconds?: number;
  createdAt: number;
}

export type BallotChoice = 'favor' | 'against' | 'abstain';
export type VotingType = 'procedural' | 'substantive';
export type RequiredMajority = 'simple' | 'twoThirds' | 'securityCouncil9' | 'consensus';

export interface Vote {
  id: string;
  label?: string;
  votingType: VotingType;
  requiredMajority: RequiredMajority;
  ballots: Record<string, BallotChoice>; // delegateId -> choice
  resultsHidden: boolean;
  outcome?: 'passed' | 'failed';
  // If this vote adopts a draft resolution / working paper, its sponsors earn credit.
  subjectKind?: 'draftResolution' | 'workingPaper' | 'procedural';
  sponsors?: string[]; // delegateId[]
  createdAt: number;
  closedAt?: number;
}

export interface Session {
  id: string;
  munEventId: string;
  label: string; // "Session I"
  status: 'notStarted' | 'inProgress' | 'ended';
  startedAt?: number;
  endedAt?: number;
  rollCall: Record<string, RollCallStatus>;
  rollCallDone: boolean;
  agendaItem?: string;
  gslQueue: SpeakerListEntry[];
  gslPerSpeakerSeconds: number;
  modState: CaucusState | null;
  unmodState: CaucusState | null;
  singleSpeakerLog: SingleSpeakerEvent[];
  motions: Motion[];
  votes: Vote[];
}

export interface MunEvent {
  id: string;
  name: string;
  logoEmoji?: string;
  createdAt: number;
  roster: Delegate[];
  sessionIds: string[];
  status: 'active' | 'ended';
  endedAt?: number;
}

export type ScoreCategory =
  | 'gsl'
  | 'caucus'
  | 'time'
  | 'motion'
  | 'rtr'
  | 'wp'
  | 'dr'
  | 'poi'
  | 'attendance'
  | 'manual';

export interface ScoreEvent {
  id: string;
  munEventId: string;
  sessionId: string;
  delegateId: string;
  category: ScoreCategory;
  points: number;
  reason?: string;
  createdBy?: string;
  createdAt: number;
  // Provenance so auto-generated events can be reconciled/deduped.
  sourceRef?: string;
}

export interface Comment {
  id: string;
  munEventId: string;
  sessionId: string;
  delegateId: string;
  authorName: string;
  text: string;
  rubric?: { prep: number; diplomacy: number; speaking: number };
  createdAt: number;
  editedAt?: number;
}

// Full serializable application state.
export interface AppData {
  version: 1;
  events: MunEvent[];
  sessions: Session[];
  scoreEvents: ScoreEvent[];
  comments: Comment[];
  chairName: string;
}

export const emptyAppData = (): AppData => ({
  version: 1,
  events: [],
  sessions: [],
  scoreEvents: [],
  comments: [],
  chairName: 'Chair',
});
