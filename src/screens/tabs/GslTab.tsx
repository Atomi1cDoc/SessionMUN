import { useEffect, useMemo, useState } from 'react';
import { Reorder } from 'framer-motion';
import type { Session, Delegate, SpeakerListEntry } from '../../types';
import { actions, type GslYield } from '../../store/store';
import { Flag } from '../../components/Flag';
import { Modal } from '../../components/Modal';
import { formatClock, classNames } from '../../lib/util';
import { useTimer } from '../../components/useTimer';
import {
  IconPeople, IconGear, IconRefresh, IconPlay, IconPause, IconPlus, IconChevronRight, IconCheck, IconClose,
} from '../../components/icons';

export function GslTab({
  session, delegates, readOnly, onRollCall,
}: { session: Session; delegates: Delegate[]; readOnly: boolean; onRollCall: () => void }) {
  const byId = useMemo(() => new Map(delegates.map((d) => [d.id, d])), [delegates]);
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const current = session.gslQueue.find((e) => e.status === 'speaking');
  const upcoming = session.gslQueue.filter((e) => e.status === 'queued');
  const per = session.gslPerSpeakerSeconds;

  const timer = useTimer({ initialSeconds: per });
  const [yieldOpen, setYieldOpen] = useState(false);
  // Set when a delegate accepts a yield mid-turn: the live timer keeps
  // counting down (never reset) rather than starting a fresh full duration,
  // and `startRemaining` is the countdown value at the moment they took over
  // so the eventual elapsed time can be computed as startRemaining - remaining.
  const [guest, setGuest] = useState<{ delegateId: string; startRemaining: number } | null>(null);

  const effectiveId = guest?.delegateId ?? current?.delegateId;
  const effectiveDelegate = effectiveId ? byId.get(effectiveId) : undefined;

  const openYield = () => {
    if (readOnly || !effectiveId) return;
    if (guest) {
      // A guest's segment ends automatically on "Next Speaker" — no prompt,
      // just absorb whatever time is left and move on to the real next speaker.
      const elapsed = Math.max(0, guest.startRemaining - timer.remaining);
      actions.finishGslGuest(session.id, guest.delegateId, elapsed);
      actions.nextGslSpeaker(session.id); // current queue entry is already 'spoken' -> just promotes next
      setGuest(null);
      timer.reset(per);
      return;
    }
    setYieldOpen(true);
  };

  const finishYield = (gslYield?: GslYield) => {
    actions.nextGslSpeaker(session.id, per - timer.remaining, gslYield);
    timer.reset(per);
    setYieldOpen(false);
  };

  const acceptYield = (toDelegateId: string) => {
    actions.yieldGslToOther(session.id, per - timer.remaining, toDelegateId);
    setGuest({ delegateId: toDelegateId, startRemaining: timer.remaining });
    setYieldOpen(false);
    // Timer is left exactly as-is — it keeps counting down for the new speaker.
  };

  const inQueueIds = new Set(session.gslQueue.filter((e) => e.status !== 'spoken').map((e) => e.delegateId));
  const addable = delegates.filter(
    (d) => !inQueueIds.has(d.id) && d.countryName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const warn = timer.remaining <= 10;

  return (
    <>
      <div className="timer-card">
        <div className={classNames('timer-display', warn && 'warn')}>
          {formatClock(timer.remaining)} <span className="total">/ {formatClock(per)}</span>
        </div>
        <div className="muted" style={{ marginTop: 4 }}>
          {effectiveDelegate ? `Now: ${effectiveDelegate.countryName}` : 'General Speakers List'}
        </div>
        <div className="control-row">
          <button className="square-btn sq-dark" onClick={onRollCall} title="Roll call"><IconPeople /></button>
          <button className="square-btn sq-orange" onClick={() => setSettingsOpen(true)} title="Speaker time"><IconGear /></button>
          <button
            className="square-btn sq-blue"
            onClick={() => {
              timer.reset(per);
              if (guest) setGuest((g) => (g ? { ...g, startRemaining: per } : g));
            }}
            title="Reset"
          >
            <IconRefresh />
          </button>
          <button
            className="square-btn sq-play"
            disabled={readOnly || !effectiveId}
            onClick={() => timer.toggle()}
            title="Start / pause"
          >
            {timer.running ? <IconPause /> : <IconPlay />}
          </button>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <h3>Current Speaker</h3>
            <div className="spacer" />
            <button className="btn btn-navy btn-sm" disabled={readOnly || !effectiveId} onClick={openYield}>
              Next Speaker <IconChevronRight size={16} />
            </button>
          </div>
          {effectiveDelegate ? (
            <div className="speaker-row speaking">
              <Flag delegate={effectiveDelegate} size={22} />
              <strong>{effectiveDelegate.countryName}</strong>
              {guest && <span className="chip" style={{ marginLeft: 8 }}>Yielded floor</span>}
            </div>
          ) : (
            <div className="gate-msg">No active speaker. Add delegates to the list.</div>
          )}

          <h3 style={{ marginTop: 18 }}>Upcoming Speakers</h3>
          <UpcomingSpeakers sessionId={session.id} upcoming={upcoming} byId={byId} readOnly={readOnly} />
        </div>

        <div className="panel">
          <h3>Add Speaker</h3>
          {!session.rollCallDone ? (
            <div className="gate-msg">
              Conduct a roll call before adding speakers.
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={onRollCall} disabled={readOnly}>Open Roll Call</button>
              </div>
            </div>
          ) : (
            <>
              <input className="input" placeholder="Search delegates…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
              <div className="add-list">
                {addable.map((d) => (
                  <div key={d.id} className="add-row" onClick={() => !readOnly && actions.addGslSpeaker(session.id, d.id)}>
                    <Flag delegate={d} size={18} />
                    <span>{d.countryName}</span>
                    <IconPlus size={16} className="" />
                  </div>
                ))}
                {addable.length === 0 && <div className="muted" style={{ padding: 8, fontSize: 14 }}>No delegates match.</div>}
              </div>
            </>
          )}
        </div>
      </div>

      {settingsOpen && (
        <SpeakerTimeModal
          current={per}
          onClose={() => setSettingsOpen(false)}
          onSave={(s) => { actions.setGslPerSpeaker(session.id, s); timer.reset(s); setSettingsOpen(false); }}
        />
      )}

      {yieldOpen && current && (
        <YieldModal
          delegateName={byId.get(current.delegateId)?.countryName ?? ''}
          delegates={delegates}
          excludeId={current.delegateId}
          onClose={() => setYieldOpen(false)}
          onSubmit={finishYield}
          onAcceptOther={acceptYield}
        />
      )}
    </>
  );
}

/**
 * Drag-to-reorder Upcoming Speakers list, built on Framer Motion's `Reorder`
 * rather than hand-rolled drag math: `items` is local UI state so the list
 * reflows live (other chips animate out of the way) as you drag, and we only
 * write the final order back to the store once, on release.
 */
function UpcomingSpeakers({
  sessionId, upcoming, byId, readOnly,
}: { sessionId: string; upcoming: SpeakerListEntry[]; byId: Map<string, Delegate>; readOnly: boolean }) {
  const [items, setItems] = useState(upcoming);

  // Re-sync from the store when the queued set actually changes (add/remove/
  // promote a speaker) — not on every render, so it never fights an in-flight drag.
  // Keyed on the id sequence, not the `upcoming` array reference itself, so an
  // unrelated re-render mid-drag never resets this from under the user's hand.
  const idsKey = upcoming.map((e) => e.id).join(',');
  useEffect(() => {
    setItems(upcoming);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on idsKey, not upcoming
  }, [idsKey]);

  if (upcoming.length === 0) {
    return <div className="muted" style={{ fontSize: 14 }}>Queue is empty.</div>;
  }

  const commit = (ordered: SpeakerListEntry[]) => {
    actions.setGslQueueOrder(sessionId, ordered.map((e) => e.id));
  };

  return (
    <Reorder.Group as="div" axis="y" values={items} onReorder={setItems} className="speaker-queue">
      {items.map((e, i) => (
        <Reorder.Item
          key={e.id}
          value={e}
          as="div"
          drag={!readOnly}
          dragListener={!readOnly}
          onDragEnd={() => commit(items)}
          whileDrag={{ scale: 1.03, boxShadow: '0 10px 30px rgba(76,12,12,0.28)', zIndex: 20 }}
          className="speaker-row"
          style={{ cursor: readOnly ? 'default' : 'grab' }}
        >
          <span className="order">{i + 1}</span>
          <Flag delegate={byId.get(e.delegateId)!} size={18} />
          <span>{byId.get(e.delegateId)?.countryName}</span>
          {!readOnly && (
            <button
              className="icon-btn"
              style={{ marginLeft: 'auto' }}
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={() => actions.removeGslSpeaker(sessionId, e.id)}
            >
              ✕
            </button>
          )}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

function YieldModal({
  delegateName, delegates, excludeId, onSubmit, onAcceptOther, onClose,
}: {
  delegateName: string;
  delegates: Delegate[];
  excludeId: string;
  onSubmit: (gslYield?: GslYield) => void;
  onAcceptOther: (delegateId: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'root' | 'poi' | 'other'>('root');
  const [otherId, setOtherId] = useState('');
  const [search, setSearch] = useState('');

  const candidates = delegates.filter(
    (d) => d.id !== excludeId && d.countryName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Modal title="How did they yield?" onClose={onClose} maxWidth={420}>
      {mode === 'root' && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>{delegateName} is yielding the floor. What happens next?</p>
          <div className="stack" style={{ gap: 10 }}>
            <button className="radio-card" onClick={() => onSubmit()}>Yield to the Chair</button>
            <button className="radio-card" onClick={() => setMode('poi')}>Yield to Points of Information</button>
            <button className="radio-card" onClick={() => setMode('other')}>Yield to Other Delegate</button>
          </div>
        </>
      )}

      {mode === 'poi' && (
        <div>
          <label className="field-label">How did they handle the questions?</label>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSubmit({ type: 'poi', result: 1 })}>
              <IconCheck size={16} /> Answered well (+1)
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => onSubmit()}>
              No change
            </button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => onSubmit({ type: 'poi', result: -1 })}>
              <IconClose size={16} /> Struggled (−1)
            </button>
          </div>
        </div>
      )}

      {mode === 'other' && (
        <div>
          <label className="field-label">Yielding to which delegate?</label>
          <input
            className="input"
            placeholder="Search delegates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div className="add-list" style={{ maxHeight: 220 }}>
            {candidates.map((d) => (
              <div
                key={d.id}
                className="add-row"
                style={{ background: otherId === d.id ? '#fbf1de' : undefined }}
                onClick={() => setOtherId(d.id)}
              >
                <Flag delegate={d} size={18} />
                <span>{d.countryName}</span>
              </div>
            ))}
            {candidates.length === 0 && <div className="muted" style={{ padding: 8, fontSize: 14 }}>No delegates match.</div>}
          </div>
          {otherId && (
            <div className="row" style={{ gap: 10, marginTop: 14 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onAcceptOther(otherId)}>They accept</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => onSubmit()}>They decline</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function SpeakerTimeModal({ current, onClose, onSave }: { current: number; onClose: () => void; onSave: (s: number) => void }) {
  const [val, setVal] = useState(current);
  return (
    <Modal title="Speaker Time" onClose={onClose} maxWidth={360}>
      <label className="field-label">Seconds per speaker</label>
      <div className="row" style={{ gap: 10 }}>
        <input className="input" type="number" min={5} step={5} value={val} onChange={(e) => setVal(Number(e.target.value))} />
      </div>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        {[30, 45, 60, 90, 120].map((s) => (
          <button key={s} className="btn btn-outline btn-sm" onClick={() => setVal(s)}>{s}s</button>
        ))}
      </div>
      <button className="submit-dark" style={{ marginTop: 18 }} onClick={() => onSave(Math.max(5, val))}>Save</button>
    </Modal>
  );
}
