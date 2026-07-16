import { useMemo, useState } from 'react';
import type { Session, Delegate } from '../../types';
import { actions } from '../../store/store';
import { Flag } from '../../components/Flag';
import { formatClock, classNames } from '../../lib/util';
import { useTimer } from '../../components/useTimer';
import {
  IconPlay, IconPause, IconRefresh, IconPlus, IconChevronRight, IconClose,
} from '../../components/icons';

export function CaucusTab({
  which, session, delegates, readOnly,
}: { which: 'mod' | 'unmod'; session: Session; delegates: Delegate[]; readOnly: boolean }) {
  const caucus = which === 'mod' ? session.modState : session.unmodState;

  if (!caucus) {
    return <CaucusSetup which={which} session={session} readOnly={readOnly} />;
  }
  return <CaucusRunner which={which} session={session} delegates={delegates} readOnly={readOnly} />;
}

function CaucusSetup({ which, session, readOnly }: { which: 'mod' | 'unmod'; session: Session; readOnly: boolean }) {
  const [topic, setTopic] = useState('');
  const [totalMin, setTotalMin] = useState(10);
  const [perSpeaker, setPerSpeaker] = useState(60);
  const isMod = which === 'mod';

  return (
    <div className="panel" style={{ maxWidth: 460, margin: '0 auto' }}>
      <h3>{isMod ? 'Start a Moderated Caucus' : 'Start an Unmoderated Caucus'}</h3>
      {isMod && (
        <>
          <label className="field-label">Topic</label>
          <input className="input" placeholder="Caucus topic…" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ marginBottom: 12 }} />
        </>
      )}
      <div className="row" style={{ gap: 12 }}>
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
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 16 }}
        disabled={readOnly}
        onClick={() =>
          actions.configureCaucus(session.id, which, {
            topic: isMod ? topic || undefined : undefined,
            totalSeconds: totalMin * 60,
            perSpeakerSeconds: isMod ? perSpeaker : undefined,
          })
        }
      >
        Start caucus
      </button>
    </div>
  );
}

function CaucusRunner({
  which, session, delegates, readOnly,
}: { which: 'mod' | 'unmod'; session: Session; delegates: Delegate[]; readOnly: boolean }) {
  const caucus = (which === 'mod' ? session.modState : session.unmodState)!;
  const byId = useMemo(() => new Map(delegates.map((d) => [d.id, d])), [delegates]);
  const [search, setSearch] = useState('');
  const isMod = which === 'mod';

  const total = useTimer({
    initialSeconds: caucus.remainingSeconds,
    onCommit: (rem) => actions.setCaucusRemaining(session.id, which, rem),
    onExpire: () => {
      actions.setCaucusRemaining(session.id, which, 0);
      actions.setCaucusStatus(session.id, which, 'ended');
    },
  });

  const per = useTimer({ initialSeconds: caucus.perSpeakerSeconds ?? 60 });

  const running = total.running;
  const toggle = () => {
    if (running) { total.pause(); if (isMod) per.pause(); }
    else { total.start(); if (isMod) per.start(); }
  };

  const current = caucus.speakerQueue?.find((e) => e.status === 'speaking');
  const upcoming = caucus.speakerQueue?.filter((e) => e.status === 'queued') ?? [];

  const nextSpeaker = () => {
    const per0 = caucus.perSpeakerSeconds ?? 60;
    actions.nextCaucusSpeaker(session.id, per0 - per.remaining);
    per.reset(per0);
  };

  const inQueue = new Set((caucus.speakerQueue ?? []).filter((e) => e.status !== 'spoken').map((e) => e.delegateId));
  const addable = delegates.filter(
    (d) => !inQueue.has(d.id) && d.countryName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const endCaucus = () => {
    total.pause();
    actions.endCaucus(session.id, which);
  };

  return (
    <>
      {isMod && (
        <div className="timer-topic">Topic: {caucus.topic || <span className="muted">—</span>}</div>
      )}

      <div className="timer-card">
        <div className={classNames('timer-display', total.remaining <= 10 && 'warn')}>
          {formatClock(total.remaining)} <span className="total">/ {formatClock(caucus.totalSeconds)}</span>
        </div>

        {isMod ? (
          <>
            <div className="timer-divider" />
            <div className={classNames('timer-display', per.remaining <= 10 && 'warn')}>
              {formatClock(per.remaining)} <span className="total">/ {formatClock(caucus.perSpeakerSeconds ?? 60)}</span>
            </div>
          </>
        ) : (
          <div className="progress-track" style={{ marginTop: 20 }}>
            <div
              className={classNames('progress-fill', total.remaining <= 10 && 'urgent')}
              style={{
                width: `${caucus.totalSeconds > 0 ? Math.min(100, Math.max(0, ((caucus.totalSeconds - total.remaining) / caucus.totalSeconds) * 100)) : 100}%`,
              }}
            />
          </div>
        )}

        <div className="control-row" style={{ marginTop: 20 }}>
          <button className="square-btn sq-blue" onClick={() => { total.reset(caucus.remainingSeconds); per.reset(caucus.perSpeakerSeconds ?? 60); }} title="Reset"><IconRefresh /></button>
          <button className="square-btn sq-play" disabled={readOnly} onClick={toggle} title="Start / pause">
            {running ? <IconPause /> : <IconPlay />}
          </button>
          <button className="square-btn sq-red" disabled={readOnly} onClick={endCaucus} title="End caucus"><IconClose /></button>
        </div>
        <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          Ending the caucus returns control to the GSL where it left off.
        </div>
      </div>

      {isMod && (
        <div className="two-col">
          <div className="panel">
            <div className="panel-head">
              <h3>Caucus Speaker</h3>
              <div className="spacer" />
              <button className="btn btn-navy btn-sm" disabled={readOnly || !current} onClick={nextSpeaker}>
                Next <IconChevronRight size={16} />
              </button>
            </div>
            {current ? (
              <div className="speaker-row speaking">
                <Flag delegate={byId.get(current.delegateId)!} size={20} />
                <strong>{byId.get(current.delegateId)?.countryName}</strong>
              </div>
            ) : (
              <div className="gate-msg">No active speaker.</div>
            )}
            <h3 style={{ marginTop: 16 }}>Upcoming</h3>
            {upcoming.length === 0 ? <div className="muted" style={{ fontSize: 14 }}>Queue is empty.</div> :
              upcoming.map((e, i) => (
                <div key={e.id} className="speaker-row">
                  <span className="order">{i + 1}</span>
                  <Flag delegate={byId.get(e.delegateId)!} size={18} />
                  <span>{byId.get(e.delegateId)?.countryName}</span>
                </div>
              ))}
          </div>

          <div className="panel">
            <h3>Add to caucus queue</h3>
            <input className="input" placeholder="Search delegates…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
            <div className="add-list">
              {addable.map((d) => (
                <div key={d.id} className="add-row" onClick={() => !readOnly && actions.addCaucusSpeaker(session.id, d.id)}>
                  <Flag delegate={d} size={18} />
                  <span>{d.countryName}</span>
                  <IconPlus size={16} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
