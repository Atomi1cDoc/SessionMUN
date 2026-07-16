import { useState } from 'react';
import { Modal } from '../components/Modal';
import { Flag } from '../components/Flag';
import { actions } from '../store/store';
import type { Session, Delegate, RollCallStatus } from '../types';
import { classNames } from '../lib/util';

const OPTIONS: { value: RollCallStatus; label: string; cls: string }[] = [
  { value: 'presentVoting', label: 'P & Voting', cls: 'on-favor' },
  { value: 'present', label: 'Present', cls: 'on-abstain' },
  { value: 'absent', label: 'Absent', cls: 'on-against' },
];

export function RollCallModal({
  session, delegates, readOnly, onClose,
}: { session: Session; delegates: Delegate[]; readOnly: boolean; onClose: () => void }) {
  const [local, setLocal] = useState<Record<string, RollCallStatus>>(() => ({ ...session.rollCall }));

  const set = (id: string, status: RollCallStatus) => {
    setLocal((prev) => ({ ...prev, [id]: status }));
    if (!readOnly) actions.setRollCall(session.id, id, status);
  };

  const markedCount = Object.keys(local).length;

  return (
    <Modal title={`Roll Call — ${session.label}`} onClose={onClose} maxWidth={560}>
      <p className="muted" style={{ marginTop: 0 }}>
        Mark each delegate's attendance. Completing roll call unlocks the speakers list and feeds the quorum counters.
      </p>
      <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
        {delegates.map((d) => (
          <div key={d.id} className="ballot-row">
            <Flag delegate={d} size={18} />
            <span>{d.countryName}</span>
            <div className="ballot-btns">
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  disabled={readOnly}
                  className={classNames('ballot-btn', local[d.id] === o.value && o.cls)}
                  onClick={() => set(d.id, o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16, gap: 10 }}>
        <span className="muted">{markedCount}/{delegates.length} marked</span>
        <div className="spacer" />
        {!readOnly && (
          <button
            className="btn btn-primary"
            onClick={() => { actions.completeRollCall(session.id); onClose(); }}
          >
            {session.rollCallDone ? 'Update Roll Call' : 'Complete Roll Call'}
          </button>
        )}
      </div>
    </Modal>
  );
}
