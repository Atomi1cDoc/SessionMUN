import { useRef } from 'react';
import { actions, useStore } from '../store/store';
import { Flag } from '../components/Flag';
import { IconPlay, IconTrophy, IconDownload, IconUpload, IconChevronRight, IconPlus } from '../components/icons';
import { exportAppData, parseImportedData } from '../lib/persistence';
import type { Session } from '../types';

export function Home({ eventId }: { eventId: string }) {
  const event = useStore((s) => s.data.events.find((e) => e.id === eventId));
  const sessions = useStore((s) =>
    s.data.sessions
      .filter((x) => x.munEventId === eventId)
      .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)),
  );
  const allData = useStore((s) => s.data);
  const chairName = useStore((s) => s.data.chairName);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!event) return <div className="home">Committee not found.</div>;

  const inProgress = sessions.find((s) => s.status === 'inProgress');
  const ended = event.status === 'ended';

  const doEndEvent = () => {
    const msg = inProgress
      ? 'End this committee? The in-progress session will be ended immediately and you’ll need to complete post-session review before returning home. No further sessions can be started afterward. Continue?'
      : 'End this committee? No further sessions can be started. Scoreboard and export remain available. Continue?';
    if (confirm(msg)) actions.endEvent(eventId);
  };

  const doExport = () => {
    const blob = new Blob([exportAppData(allData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessionmun-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = parseImportedData(String(reader.result));
        if (confirm('Import will replace ALL current data on this device. Continue?')) {
          actions.replaceAll(data);
          if (data.events[0]) actions.go({ name: 'home', eventId: data.events[0].id });
        }
      } catch (err) {
        alert('Import failed: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-root home">
      <div className="home-hero">
        <div className="home-logo">{event.logoEmoji ?? '🌐'}</div>
        <div>
          <h1 style={{ margin: 0, color: 'var(--navy)' }}>
            {event.name}
            {ended && <span className="chip" style={{ marginLeft: 10, background: '#fbeceb', color: 'var(--red)' }}>Ended</span>}
          </h1>
          <div className="muted">{event.roster.length} delegations · {sessions.length} session{sessions.length === 1 ? '' : 's'}</div>
        </div>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={() => actions.openScoreboard()}>
          <IconTrophy size={18} /> Scoreboard
        </button>
      </div>

      <div className="home-grid">
        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="row">
              <h3 style={{ margin: 0, color: 'var(--navy)' }}>Sessions</h3>
              <div className="spacer" />
              {!ended && (
                <>
                  {inProgress ? (
                    <button className="btn btn-primary" onClick={() => actions.openSession(inProgress.id, false)}>
                      <IconPlay size={18} /> Resume Session
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => actions.startSession(eventId)}>
                      <IconPlay size={18} /> Start Session
                    </button>
                  )}
                  <button className="btn btn-outline" style={{ marginLeft: 8 }} onClick={doEndEvent}>
                    End Event
                  </button>
                </>
              )}
            </div>
            {ended ? (
              <div className="gate-msg" style={{ marginTop: 10 }}>
                This committee has ended. Scoreboard and export remain available below.
              </div>
            ) : (
              inProgress && (
                <div className="row" style={{ marginTop: 10 }}>
                  <span className="muted">A session is in progress.</span>
                  <div className="spacer" />
                  <button className="btn btn-outline btn-sm" onClick={() => actions.startSession(eventId)}>
                    <IconPlus size={16} /> New session
                  </button>
                </div>
              )
            )}

            <div style={{ marginTop: 14 }}>
              {sessions.length === 0 ? (
                <div className="gate-msg">No sessions yet. Start your first session above.</div>
              ) : (
                sessions.map((s) => <SessionRow key={s.id} session={s} />)
              )}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: '0 0 12px', color: 'var(--navy)' }}>Roster</h3>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {event.roster.map((d) => (
                <div key={d.id} className="row" style={{ gap: 10, padding: '6px 0' }}>
                  <Flag delegate={d} size={18} />
                  <span>{d.countryName}</span>
                  <span className="spacer" />
                  <span className="muted" style={{ fontSize: 12 }}>{d.countryCode}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: '0 0 12px', color: 'var(--navy)' }}>Chair</h3>
            <label className="field-label">Your name (attributes comments &amp; adjustments)</label>
            <input
              className="input"
              defaultValue={chairName}
              placeholder="Chair"
              onBlur={(e) => actions.setChairName(e.target.value)}
            />
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: '0 0 12px', color: 'var(--navy)' }}>Backup</h3>
            <div className="stack" style={{ gap: 8 }}>
              <button className="btn btn-outline btn-block" onClick={doExport}>
                <IconDownload /> Export all data (JSON)
              </button>
              <button className="btn btn-outline btn-block" onClick={() => fileRef.current?.click()}>
                <IconUpload /> Import / restore
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
              />
              <button className="btn btn-ghost btn-block" onClick={() => actions.goSetup()}>
                <IconPlus size={16} /> New committee
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: Session }) {
  const ended = session.status === 'ended';
  return (
    <div className="session-item">
      <span className={`status-dot ${ended ? 'dot-ended' : 'dot-inProgress'}`} />
      <div className="stack">
        <strong>{session.label}</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          {ended
            ? `Ended ${session.endedAt ? new Date(session.endedAt).toLocaleString() : ''}`
            : 'In progress'}
        </span>
      </div>
      <div className="spacer" />
      {ended ? (
        <button className="btn btn-outline btn-sm" onClick={() => actions.openSession(session.id, true)}>
          Review <IconChevronRight size={16} />
        </button>
      ) : (
        <>
          <button className="btn btn-outline btn-sm" onClick={() => actions.endSession(session.id)}>
            End
          </button>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => actions.openSession(session.id, false)}>
            Open <IconChevronRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}
