import { useMemo, useState } from 'react';
import type { Session, Delegate, MotionType } from '../../types';
import { actions } from '../../store/store';
import { Flag } from '../../components/Flag';
import { Modal } from '../../components/Modal';
import { classNames, formatClock } from '../../lib/util';
import { IconPlus, IconGavel, IconCheck, IconClose } from '../../components/icons';

const MOTION_TYPES: { value: MotionType; label: string; caucus?: 'mod' | 'unmod' }[] = [
  { value: 'moderatedCaucus', label: 'Moderated Caucus', caucus: 'mod' },
  { value: 'unmoderatedCaucus', label: 'Unmoderated Caucus', caucus: 'unmod' },
  { value: 'introduceDraftResolution', label: 'Introduce Draft Resolution' },
  { value: 'introduceWorkingPaper', label: 'Introduce Working Paper' },
  { value: 'openDebate', label: 'Open Debate' },
  { value: 'closeDebate', label: 'Close Debate / Move to Voting' },
  { value: 'suspendMeeting', label: 'Suspend the Meeting' },
  { value: 'other', label: 'Other' },
];

export function MotionsTab({
  session, delegates, readOnly, onOpenMod,
}: { session: Session; delegates: Delegate[]; readOnly: boolean; onOpenMod: () => void }) {
  const byId = useMemo(() => new Map(delegates.map((d) => [d.id, d])), [delegates]);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h3><IconGavel size={18} /> &nbsp;Motions</h3>
          <div className="spacer" />
          {!readOnly && <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}><IconPlus size={16} /> Raise motion</button>}
        </div>

        {session.motions.length === 0 ? (
          <div className="gate-msg">No motions raised yet.</div>
        ) : (
          <div>
            {session.motions.map((m) => {
              const caucus = MOTION_TYPES.find((t) => t.value === m.type)?.caucus;
              return (
                <div key={m.id} className={classNames('motion-card', m.result)}>
                  <div className="row" style={{ gap: 10 }}>
                    <Flag delegate={byId.get(m.proposedBy)!} size={18} />
                    <div className="stack">
                      <strong>{m.label}</strong>
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        Proposed by {byId.get(m.proposedBy)?.countryName}
                        {m.totalSeconds ? ` · ${formatClock(m.totalSeconds)}${m.perSpeakerSeconds ? ` / ${m.perSpeakerSeconds}s` : ''}` : ''}
                        {m.seconds.length > 0 ? ` · ${m.seconds.length} second(s)` : ''}
                      </span>
                    </div>
                    <div className="spacer" />
                    <span className={`result-pill result-${m.result}`}>{m.result}</span>
                  </div>
                  {!readOnly && m.result === 'pending' && (
                    <div className="row" style={{ gap: 8, marginTop: 10 }}>
                      <button
                        className="btn btn-blue btn-sm"
                        onClick={() => {
                          actions.setMotionResult(session.id, m.id, 'passed');
                          if (caucus === 'mod') {
                            actions.configureCaucus(session.id, 'mod', {
                              topic: m.label,
                              totalSeconds: m.totalSeconds ?? 600,
                              perSpeakerSeconds: m.perSpeakerSeconds ?? 60,
                            });
                            onOpenMod();
                          } else if (caucus === 'unmod') {
                            actions.configureCaucus(session.id, 'unmod', { totalSeconds: m.totalSeconds ?? 600 });
                          }
                        }}
                      >
                        <IconCheck size={15} /> Pass{caucus ? ' & open' : ''}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => actions.setMotionResult(session.id, m.id, 'failed')}>
                        <IconClose size={15} /> Fail
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => actions.removeMotion(session.id, m.id)}>Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {addOpen && <AddMotionModal session={session} delegates={delegates} onClose={() => setAddOpen(false)} />}
    </>
  );
}

function AddMotionModal({ session, delegates, onClose }: { session: Session; delegates: Delegate[]; onClose: () => void }) {
  const [type, setType] = useState<MotionType>('moderatedCaucus');
  const [proposer, setProposer] = useState(delegates[0]?.id ?? '');
  const [totalMin, setTotalMin] = useState(10);
  const [perSpeaker, setPerSpeaker] = useState(60);

  const meta = MOTION_TYPES.find((t) => t.value === type)!;
  const isCaucus = !!meta.caucus;
  const isMod = meta.caucus === 'mod';

  const submit = () => {
    if (!proposer) return;
    const total = totalMin * 60;
    let label = meta.label;
    if (isMod) label = `${totalMin}-min moderated caucus, ${perSpeaker}s speeches`;
    else if (isCaucus) label = `${totalMin}-min unmoderated caucus`;
    actions.addMotion(session.id, {
      type,
      label,
      proposedBy: proposer,
      totalSeconds: isCaucus ? total : undefined,
      perSpeakerSeconds: isMod ? perSpeaker : undefined,
    });
    onClose();
  };

  return (
    <Modal title="Raise a Motion" onClose={onClose}>
      <label className="field-label">Motion type</label>
      <select className="input" value={type} onChange={(e) => setType(e.target.value as MotionType)}>
        {MOTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <label className="field-label" style={{ marginTop: 14 }}>Proposed by</label>
      <select className="input" value={proposer} onChange={(e) => setProposer(e.target.value)}>
        {delegates.map((d) => <option key={d.id} value={d.id}>{d.countryName}</option>)}
      </select>

      {isCaucus && (
        <div className="row" style={{ gap: 12, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Total time (min)</label>
            <input className="input" type="number" min={1} value={totalMin} onChange={(e) => setTotalMin(Number(e.target.value))} />
          </div>
          {isMod && (
            <div style={{ flex: 1 }}>
              <label className="field-label">Per speaker (sec)</label>
              <input className="input" type="number" min={5} step={5} value={perSpeaker} onChange={(e) => setPerSpeaker(Number(e.target.value))} />
            </div>
          )}
        </div>
      )}

      <button className="submit-dark" style={{ marginTop: 20 }} onClick={submit}>Add motion</button>
    </Modal>
  );
}
