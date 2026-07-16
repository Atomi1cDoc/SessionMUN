import { useMemo, useState } from 'react';
import type { Session, Delegate, SingleSpeakerType } from '../../types';
import { actions } from '../../store/store';
import { Flag } from '../../components/Flag';
import { formatClock, classNames } from '../../lib/util';
import { useTimer } from '../../components/useTimer';
import { IconPlay, IconPause, IconRefresh, IconCheck } from '../../components/icons';

const TYPES: { value: SingleSpeakerType; label: string }[] = [
  { value: 'rightOfReply', label: 'Right of Reply' },
  { value: 'personalPrivilege', label: 'Point of Personal Privilege' },
  { value: 'other', label: 'Other Statement' },
];

export function SingleSpeakerTab({ session, delegates, readOnly }: { session: Session; delegates: Delegate[]; readOnly: boolean }) {
  const byId = useMemo(() => new Map(delegates.map((d) => [d.id, d])), [delegates]);
  const [delegateId, setDelegateId] = useState(delegates[0]?.id ?? '');
  const [type, setType] = useState<SingleSpeakerType>('rightOfReply');
  const [seconds, setSeconds] = useState(30);

  const timer = useTimer({ initialSeconds: seconds });
  const warn = timer.remaining <= 5;

  const log = () => {
    if (!delegateId) return;
    const used = seconds - timer.remaining;
    actions.logSingleSpeaker(session.id, { delegateId, type, seconds: used > 0 ? used : seconds });
    timer.reset(seconds);
  };

  return (
    <>
      <div className="timer-card">
        <div className="chip" style={{ marginBottom: 10 }}>{TYPES.find((t) => t.value === type)?.label}</div>
        <div className={classNames('timer-display', warn && 'warn')}>
          {formatClock(timer.remaining)} <span className="total">/ {formatClock(seconds)}</span>
        </div>
        <div className="muted" style={{ marginTop: 4 }}>
          {delegateId ? byId.get(delegateId)?.countryName : 'Select a delegate'}
        </div>
        <div className="control-row">
          <button className="square-btn sq-blue" onClick={() => timer.reset(seconds)} title="Reset"><IconRefresh /></button>
          <button className="square-btn sq-play" disabled={readOnly || !delegateId} onClick={() => timer.toggle()} title="Start / pause">
            {timer.running ? <IconPause /> : <IconPlay />}
          </button>
          <button className="square-btn sq-dark" disabled={readOnly || !delegateId} onClick={log} title="Log this floor time"><IconCheck /></button>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h3>Configure</h3>
          <label className="field-label">Delegate</label>
          <select className="input" value={delegateId} onChange={(e) => setDelegateId(e.target.value)}>
            {delegates.map((d) => <option key={d.id} value={d.id}>{d.countryName}</option>)}
          </select>
          <label className="field-label" style={{ marginTop: 12 }}>Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as SingleSpeakerType)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="field-label" style={{ marginTop: 12 }}>Time (seconds)</label>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="number" min={5} step={5} value={seconds} onChange={(e) => { const v = Number(e.target.value); setSeconds(v); timer.reset(v); }} />
            {[20, 30, 60].map((s) => <button key={s} className="btn btn-outline btn-sm" onClick={() => { setSeconds(s); timer.reset(s); }}>{s}s</button>)}
          </div>
        </div>

        <div className="panel">
          <h3>Session log</h3>
          {session.singleSpeakerLog.length === 0 ? (
            <div className="muted" style={{ fontSize: 14 }}>Nothing logged yet.</div>
          ) : (
            session.singleSpeakerLog.map((ev) => (
              <div key={ev.id} className="speaker-row">
                <Flag delegate={byId.get(ev.delegateId)!} size={18} />
                <span>{byId.get(ev.delegateId)?.countryName}</span>
                <span className="spacer" />
                <span className="chip">{TYPES.find((t) => t.value === ev.type)?.label}</span>
                <span className="muted" style={{ fontSize: 12 }}>{formatClock(ev.seconds)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
