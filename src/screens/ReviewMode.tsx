import { useState } from 'react';
import { actions, useStore } from '../store/store';
import { Flag } from '../components/Flag';
import { IconCheck, IconChevronRight, IconChevronLeft } from '../components/icons';
import { RubricRow } from './Scoreboard';
import type { Comment, Delegate } from '../types';

/**
 * Forced post-session gate: a session that just ended can't be left until
 * every roster delegate has at least one comment recorded against it. There
 * is no menu, no Home link, no scoreboard shortcut here on purpose — the
 * store also refuses to route back to `home` while an ended session still
 * has unreviewed delegates (see `go`/`hydrate` in store.ts).
 */
export function ReviewMode({ sessionId }: { sessionId: string }) {
  const session = useStore((s) => s.data.sessions.find((x) => x.id === sessionId));
  const event = useStore((s) => (session ? s.data.events.find((e) => e.id === session.munEventId) : undefined));
  const comments = useStore((s) => s.data.comments.filter((c) => c.sessionId === sessionId));
  const [openDelegateId, setOpenDelegateId] = useState<string | null>(null);

  if (!session || !event) return <div className="app-root">Session not found.</div>;

  const reviewedIds = new Set(comments.map((c) => c.delegateId));
  const remaining = event.roster.filter((d) => !reviewedIds.has(d.id));
  const allDone = remaining.length === 0;

  if (openDelegateId) {
    const delegate = event.roster.find((d) => d.id === openDelegateId)!;
    return (
      <DelegateReview
        eventId={event.id}
        sessionId={sessionId}
        delegate={delegate}
        existing={comments.filter((c) => c.delegateId === delegate.id)}
        onBack={() => setOpenDelegateId(null)}
      />
    );
  }

  return (
    <div className="app-root review-mode">
      <div className="review-head">
        <h1>Post-Session Review</h1>
        <p className="muted">
          {session.label} has ended. Leave a comment for every delegate before returning home.
        </p>
        <div className="review-progress">{event.roster.length - remaining.length} / {event.roster.length} reviewed</div>
      </div>

      <div className="review-list">
        {event.roster.map((d) => {
          const done = reviewedIds.has(d.id);
          return (
            <div key={d.id} className={`review-row${done ? ' done' : ''}`} onClick={() => setOpenDelegateId(d.id)}>
              <Flag delegate={d} size={20} />
              <span>{d.countryName}</span>
              <span className="spacer" />
              {done ? (
                <span className="chip chip-done"><IconCheck size={14} /> Reviewed</span>
              ) : (
                <span className="chip">Needs comment</span>
              )}
              <IconChevronRight size={18} />
            </div>
          );
        })}
      </div>

      <div className="review-footer">
        <button
          className="btn btn-primary btn-block"
          disabled={!allDone}
          onClick={() => actions.go({ name: 'home', eventId: event.id })}
        >
          {allDone ? 'Finish Review & Return Home' : `${remaining.length} delegate${remaining.length === 1 ? '' : 's'} remaining`}
        </button>
      </div>
    </div>
  );
}

function DelegateReview({
  eventId, sessionId, delegate, existing, onBack,
}: {
  eventId: string;
  sessionId: string;
  delegate: Delegate;
  existing: Comment[];
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  const [rubric, setRubric] = useState({ prep: 0, diplomacy: 0, speaking: 0 });
  const rubricComplete = rubric.prep > 0 && rubric.diplomacy > 0 && rubric.speaking > 0;
  const canSave = !!text.trim() && rubricComplete;

  const submit = () => {
    if (!canSave) return;
    actions.addComment({ munEventId: eventId, sessionId, delegateId: delegate.id, text, rubric });
    setText('');
    setRubric({ prep: 0, diplomacy: 0, speaking: 0 });
    onBack();
  };

  return (
    <div className="app-root review-mode">
      <button className="btn btn-ghost btn-sm" onClick={onBack}>
        <IconChevronLeft size={16} /> Back to list
      </button>

      <div className="row" style={{ gap: 12, marginTop: 14 }}>
        <Flag delegate={delegate} size={28} />
        <h2 style={{ margin: 0, color: 'var(--navy)' }}>{delegate.countryName}</h2>
      </div>

      <div className="adjust-panel" style={{ marginTop: 18 }}>
        <label className="field-label" style={{ marginBottom: 10 }}>Rubric (required)</label>
        <RubricRow label="Preparation" value={rubric.prep} onChange={(v) => setRubric((r) => ({ ...r, prep: v }))} />
        <RubricRow label="Diplomacy" value={rubric.diplomacy} onChange={(v) => setRubric((r) => ({ ...r, diplomacy: v }))} />
        <RubricRow label="Public speaking" value={rubric.speaking} onChange={(v) => setRubric((r) => ({ ...r, speaking: v }))} />
      </div>

      <label className="field-label" style={{ marginTop: 18 }}>Comment on this delegate's performance</label>
      <textarea
        className="input"
        rows={4}
        placeholder="How did they do this session…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ resize: 'vertical' }}
      />
      <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!canSave} onClick={submit}>
        Save comment
      </button>
      {!rubricComplete && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Rate all three categories to save.</div>}

      {existing.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ color: 'var(--navy)' }}>Already recorded</h3>
          {existing.map((c) => (
            <div key={c.id} className="comment-item">
              <div>{c.text}</div>
              {c.rubric && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Prep {c.rubric.prep}★ · Diplomacy {c.rubric.diplomacy}★ · Speaking {c.rubric.speaking}★
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
