import { useMemo, useState } from 'react';
import { actions, useStore } from '../store/store';
import { Flag } from '../components/Flag';
import { computeMatrix, MATRIX_COLUMNS, POINTS, round1 } from '../lib/scoring';
import type { ScoreCategory, Delegate } from '../types';
import { classNames } from '../lib/util';
import {
  IconClose, IconChevronRight, IconChevronLeft, IconDownload, IconTrash, IconEdit,
} from '../components/icons';

export function Scoreboard({ eventId }: { eventId: string }) {
  const event = useStore((s) => s.data.events.find((e) => e.id === eventId));
  const scoreEvents = useStore((s) => s.data.scoreEvents);
  const view = useStore((s) => s.ui.scoreboard.view);
  const delegateId = useStore((s) => s.ui.scoreboard.delegateId);

  const rows = useMemo(
    () => (event ? computeMatrix(event.roster, scoreEvents, { munEventId: eventId }) : []),
    [event, scoreEvents, eventId],
  );

  if (!event) return null;

  const selected = delegateId ? event.roster.find((d) => d.id === delegateId) : null;

  const exportCsv = () => {
    const header = ['Rank', 'Delegation', 'Code', 'GSL', 'POI', 'Cauc', 'Time', 'Mot', 'RTR', 'WP', 'DR', 'Manual', 'Attendance', 'Total'];
    const sorted = [...rows].sort((a, b) => b.total - a.total);
    const lines = sorted.map((r, i) =>
      [
        i + 1, `"${r.delegate.countryName}"`, r.delegate.countryCode,
        r.cells.gsl, r.cells.poi, r.cells.caucus, r.cells.time, r.cells.motion, r.cells.rtr,
        r.cells.wp, r.cells.dr, r.cells.manual, r.cells.attendance, r.total,
      ].join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.name.replace(/\s+/g, '-').toLowerCase()}-scores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sb-overlay">
      <div className="sb-head">
        <h2>Scoreboard{selected ? ` · ${selected.countryName}` : ''}</h2>
        <div className="sb-toggle">
          {!selected && (
            <>
              <button className={classNames('pill', view === 'ranking' && 'on')} onClick={() => actions.setScoreboardView('ranking')}>Ranking</button>
              <button className={classNames('pill', view === 'matrix' && 'on')} onClick={() => actions.setScoreboardView('matrix')}>Matrix</button>
            </>
          )}
          <button className="pill" onClick={exportCsv}><IconDownload size={16} /> Export CSV</button>
          <button className="pill" onClick={() => actions.closeScoreboard()}><IconClose size={16} /></button>
        </div>
      </div>

      <div className="sb-body">
        {selected ? (
          <DelegateDetail eventId={eventId} delegate={selected} />
        ) : view === 'matrix' ? (
          <MatrixView rows={rows} />
        ) : (
          <RankingView rows={rows} />
        )}
      </div>
    </div>
  );
}

function MatrixView({ rows }: { rows: ReturnType<typeof computeMatrix> }) {
  return (
    <div className="matrix-scroll">
      <table className="matrix-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Delegation</th>
            {MATRIX_COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.delegate.id} style={{ cursor: 'pointer' }} onClick={() => actions.viewDelegate(r.delegate.id)}>
              <td className="name"><Flag delegate={r.delegate} size={16} /> &nbsp;{r.delegate.countryName}</td>
              {MATRIX_COLUMNS.map((c) =>
                c.key === 'total' ? (
                  <td key={c.key} className="total">{r.total}</td>
                ) : (
                  <td key={c.key}>{r.cells[c.key as ScoreCategory] || '·'}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingView({ rows }: { rows: ReturnType<typeof computeMatrix> }) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  return (
    <div>
      {sorted.map((r, i) => (
        <div key={r.delegate.id} className="rank-row" onClick={() => actions.viewDelegate(r.delegate.id)}>
          <span className="rank-num">{i + 1}</span>
          <Flag delegate={r.delegate} size={24} />
          <span className="rank-name">{r.delegate.countryName}</span>
          <span className="total-pill">{r.total}</span>
          <IconChevronRight />
        </div>
      ))}
    </div>
  );
}

function DelegateDetail({ eventId, delegate }: { eventId: string; delegate: Delegate }) {
  const scoreEvents = useStore((s) => s.data.scoreEvents.filter((e) => e.munEventId === eventId && e.delegateId === delegate.id));
  const total = round1(scoreEvents.reduce((a, e) => a + e.points, 0));
  const attendance = round1(scoreEvents.filter((e) => e.category === 'attendance').reduce((a, e) => a + e.points, 0));
  const pv = scoreEvents.filter((e) => e.category === 'attendance' && e.points === POINTS.attendancePresentVoting).length;
  const p = scoreEvents.filter((e) => e.category === 'attendance' && e.points === POINTS.attendancePresent).length;

  const byCat = useMemo(() => {
    const m: Partial<Record<ScoreCategory, number>> = {};
    for (const e of scoreEvents) m[e.category] = (m[e.category] ?? 0) + e.points;
    for (const k of Object.keys(m) as ScoreCategory[]) m[k] = round1(m[k]!);
    return m;
  }, [scoreEvents]);

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => actions.viewDelegate(null)}>
        <IconChevronLeft size={16} /> Back
      </button>

      <div className="row" style={{ gap: 14, marginTop: 14 }}>
        <Flag delegate={delegate} size={34} />
        <div>
          <h2 style={{ margin: 0, color: 'var(--forest)' }}>{delegate.countryName}</h2>
          <div className="detail-total">{total} pts</div>
        </div>
      </div>

      <div className="adjust-panel" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0, color: 'var(--forest)' }}>Breakdown</h3>
        {CATS.map(([cat, label]) => (
          <div key={cat} className="line-item">
            <span>{label}</span>
            <strong>{byCat[cat] ?? 0}</strong>
          </div>
        ))}
        <div className="line-item">
          <span>Attendance (P {p} / P&amp;V {pv})</span>
          <strong>{attendance}</strong>
        </div>
      </div>

      <ManualAdjust eventId={eventId} delegateId={delegate.id} />
      <CommentsPanel eventId={eventId} delegateId={delegate.id} />
    </div>
  );
}

const CATS: [ScoreCategory, string][] = [
  ['gsl', 'GSL speeches'],
  ['poi', 'Points of information'],
  ['caucus', 'Caucus participation'],
  ['time', 'Floor time'],
  ['motion', 'Motions'],
  ['rtr', 'Right of reply'],
  ['wp', 'Working papers'],
  ['dr', 'Draft resolutions'],
  ['manual', 'Manual adjustments (±)'],
];

function ManualAdjust({ eventId, delegateId }: { eventId: string; delegateId: string }) {
  const sessions = useStore((s) => s.data.sessions.filter((x) => x.munEventId === eventId).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)));
  const [mode, setMode] = useState<'award' | 'deduct'>('award');
  const [pts, setPts] = useState(1);
  const [reason, setReason] = useState('');

  const apply = () => {
    if (!reason.trim()) return;
    actions.addManualAdjustment({
      munEventId: eventId,
      sessionId: sessions[sessions.length - 1]?.id ?? '',
      delegateId,
      points: mode === 'award' ? Math.abs(pts) : -Math.abs(pts),
      reason: reason.trim(),
    });
    setReason('');
    setPts(1);
  };

  return (
    <div className="adjust-panel">
      <h3 style={{ marginTop: 0, color: 'var(--forest)' }}>Manual Adjustment</h3>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="seg">
          <button className={mode === 'award' ? 'on-award' : ''} onClick={() => setMode('award')}>+ Award</button>
          <button className={mode === 'deduct' ? 'on-deduct' : ''} onClick={() => setMode('deduct')}>− Deduct</button>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setPts((n) => Math.max(1, n - 1))}>−</button>
          <strong style={{ minWidth: 40, textAlign: 'center' }}>{pts} pts</strong>
          <button className="btn btn-outline btn-sm" onClick={() => setPts((n) => n + 1)}>+</button>
        </div>
      </div>
      <input className="input" placeholder="Reason (required)…" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginTop: 12 }} />
      <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!reason.trim()} onClick={apply}>Apply</button>
    </div>
  );
}

function CommentsPanel({ eventId, delegateId }: { eventId: string; delegateId: string }) {
  const endedSessions = useStore((s) => s.data.sessions.filter((x) => x.munEventId === eventId && x.status === 'ended').sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)));
  const sessionLabels = useStore((s) => new Map(s.data.sessions.map((x) => [x.id, x.label])));
  const comments = useStore((s) => s.data.comments.filter((c) => c.munEventId === eventId && c.delegateId === delegateId).sort((a, b) => b.createdAt - a.createdAt));

  const [sessionId, setSessionId] = useState(endedSessions[endedSessions.length - 1]?.id ?? '');
  const [text, setText] = useState('');
  const [useRubric, setUseRubric] = useState(false);
  const [rubric, setRubric] = useState({ prep: 0, diplomacy: 0, speaking: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  if (endedSessions.length === 0) {
    return (
      <div className="adjust-panel">
        <h3 style={{ marginTop: 0, color: 'var(--forest)' }}>Session Comments</h3>
        <p className="muted">Comments unlock once a session has ended. End a session from the Home screen or the Live Session menu.</p>
      </div>
    );
  }

  const submit = () => {
    if (!text.trim() || !sessionId) return;
    if (editingId) {
      actions.editComment(editingId, text, useRubric ? rubric : undefined);
      setEditingId(null);
    } else {
      actions.addComment({ munEventId: eventId, sessionId, delegateId, text, rubric: useRubric ? rubric : undefined });
    }
    setText('');
    setRubric({ prep: 0, diplomacy: 0, speaking: 0 });
    setUseRubric(false);
  };

  return (
    <div className="adjust-panel">
      <h3 style={{ marginTop: 0, color: 'var(--forest)' }}>Session Comments</h3>

      <div className="row" style={{ gap: 8 }}>
        <select className="input" value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ maxWidth: 200 }}>
          {endedSessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <label className="row" style={{ gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={useRubric} onChange={(e) => setUseRubric(e.target.checked)} /> Rubric
        </label>
      </div>

      {useRubric && (
        <div style={{ marginTop: 10 }}>
          <RubricRow label="Preparation" value={rubric.prep} onChange={(v) => setRubric((r) => ({ ...r, prep: v }))} />
          <RubricRow label="Diplomacy" value={rubric.diplomacy} onChange={(v) => setRubric((r) => ({ ...r, diplomacy: v }))} />
          <RubricRow label="Public speaking" value={rubric.speaking} onChange={(v) => setRubric((r) => ({ ...r, speaking: v }))} />
        </div>
      )}

      <textarea className="input" rows={3} placeholder="Comment on this session's performance…" value={text} onChange={(e) => setText(e.target.value)} style={{ marginTop: 10, resize: 'vertical' }} />
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={submit}>{editingId ? 'Save edit' : 'Add comment'}</button>
        {editingId && <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setText(''); }}>Cancel</button>}
      </div>

      <div style={{ marginTop: 16 }}>
        {comments.length === 0 ? (
          <div className="muted" style={{ fontSize: 14 }}>No comments yet.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="comment-item">
              <div className="comment-meta">
                <span className="session-tag">{sessionLabels.get(c.sessionId) ?? 'Session'}</span>
                <strong>{c.authorName}</strong>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
                {c.editedAt && <span>(edited)</span>}
                <span className="spacer" />
                <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => { setEditingId(c.id); setText(c.text); setSessionId(c.sessionId); if (c.rubric) { setUseRubric(true); setRubric(c.rubric); } }}><IconEdit size={15} /></button>
                <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => actions.deleteComment(c.id)}><IconTrash size={15} /></button>
              </div>
              <div>{c.text}</div>
              {c.rubric && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Prep {c.rubric.prep}★ · Diplomacy {c.rubric.diplomacy}★ · Speaking {c.rubric.speaking}★
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function RubricRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <span className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={classNames('star', n <= value && 'on')} onClick={() => onChange(n === value ? 0 : n)}>★</span>
        ))}
      </span>
    </div>
  );
}
