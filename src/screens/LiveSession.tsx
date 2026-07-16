import { useMemo, useState } from 'react';
import { actions, useStore } from '../store/store';
import type { MunEvent, Session, Delegate } from '../types';
import {
  IconMenu, IconExternal, IconFullscreen, IconTrophy, IconChevronDown, IconChevronUp,
  IconMic, IconGavel, IconClock, IconUser, IconVote, IconGrid, IconClose,
} from '../components/icons';
import { RollCallModal } from './RollCallModal';
import { GslTab } from './tabs/GslTab';
import { MotionsTab } from './tabs/MotionsTab';
import { CaucusTab } from './tabs/CaucusTab';
import { SingleSpeakerTab } from './tabs/SingleSpeakerTab';
import { VoteTab } from './tabs/VoteTab';

export type TabKey = 'gsl' | 'motions' | 'mod' | 'unmod' | 'single' | 'vote';

const TABS: { key: TabKey; label: string; Icon: typeof IconMic }[] = [
  { key: 'gsl', label: 'GSL', Icon: IconMic },
  { key: 'motions', label: 'Motions', Icon: IconGavel },
  { key: 'mod', label: 'Mod', Icon: IconClock },
  { key: 'unmod', label: 'Unmod', Icon: IconClock },
  { key: 'single', label: 'Single Speaker', Icon: IconUser },
  { key: 'vote', label: 'Vote', Icon: IconVote },
];

export function LiveSession({ sessionId, readOnly }: { sessionId: string; readOnly: boolean }) {
  const session = useStore((s) => s.data.sessions.find((x) => x.id === sessionId));
  const event = useStore((s) => (session ? s.data.events.find((e) => e.id === session.munEventId) : undefined));
  const [tab, setTab] = useState<TabKey>('gsl');
  const [agendaOpen, setAgendaOpen] = useState(true);
  const [rollCallOpen, setRollCallOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const counters = useMemo(() => {
    if (!session || !event) return { present: 0, voting: 0, total: 0 };
    let present = 0, voting = 0;
    for (const d of event.roster) {
      const st = session.rollCall[d.id];
      if (st === 'present') present++;
      if (st === 'presentVoting') voting++;
    }
    return { present: present + voting, voting, total: event.roster.length };
  }, [session, event]);

  if (!session || !event) return <div className="home">Session not found.</div>;

  const delegates = event.roster;

  return (
    <div className="live">
      {/* top bar */}
      <div className="topbar">
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Menu"><IconMenu /></button>
        <div className="committee">
          <div className="topbar-logo">{event.logoEmoji ?? '🌐'}</div>
          <div className="stack">
            <span>{event.name}</span>
            <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>
              {session.label}{readOnly ? ' · Review' : ''}
            </span>
          </div>
        </div>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => actions.openScoreboard()} aria-label="Scoreboard"><IconTrophy /></button>
        <button className="icon-btn" onClick={() => window.open('https://www.un.org/en/model-united-nations', '_blank')} aria-label="Resources"><IconExternal /></button>
        <button className="icon-btn" onClick={() => toggleFullscreen()} aria-label="Fullscreen"><IconFullscreen /></button>
      </div>

      {/* agenda banner */}
      <div className="agenda-banner">
        <span className="chev" onClick={() => setAgendaOpen((v) => !v)}>
          {agendaOpen ? <IconChevronUp /> : <IconChevronDown />}
        </span>
        <div className="stack">
          <span className="agenda-title">
            {session.agendaItem ? session.agendaItem : 'No agenda has been adopted'}
          </span>
          {agendaOpen && !readOnly && (
            <input
              className="input"
              style={{ marginTop: 6, maxWidth: 380, background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
              placeholder="Set agenda item…"
              defaultValue={session.agendaItem ?? ''}
              onBlur={(e) => actions.setAgenda(session.id, e.target.value)}
            />
          )}
        </div>
        <div className="quorum-counters">
          <div className="quorum q-present"><div className="circle">{counters.present}</div><small>Present</small></div>
          <div className="quorum q-voting"><div className="circle">{counters.voting}</div><small>P &amp; V</small></div>
          <div className="quorum q-total"><div className="circle">{counters.total}</div><small>Roster</small></div>
        </div>
      </div>

      {/* body */}
      <div className="app-root live-body">
        {readOnly && (
          <div className="chip" style={{ marginBottom: 12, background: '#fdf1dd', color: 'var(--gold-dark)' }}>
            Read-only review — this session has ended.
          </div>
        )}
        {tab === 'gsl' && <GslTab session={session} delegates={delegates} readOnly={readOnly} onRollCall={() => setRollCallOpen(true)} />}
        {tab === 'motions' && <MotionsTab session={session} delegates={delegates} readOnly={readOnly} onOpenMod={() => setTab('mod')} />}
        {tab === 'mod' && <CaucusTab which="mod" session={session} delegates={delegates} readOnly={readOnly} />}
        {tab === 'unmod' && <CaucusTab which="unmod" session={session} delegates={delegates} readOnly={readOnly} />}
        {tab === 'single' && <SingleSpeakerTab session={session} delegates={delegates} readOnly={readOnly} />}
        {tab === 'vote' && <VoteTab session={session} delegates={delegates} readOnly={readOnly} />}
      </div>

      {/* bottom nav */}
      <div className="bottom-nav">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`nav-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            <span className="nav-icon"><Icon size={20} /></span>
            {label}
          </button>
        ))}
      </div>

      {rollCallOpen && (
        <RollCallModal session={session} delegates={delegates} readOnly={readOnly} onClose={() => setRollCallOpen(false)} />
      )}

      {menuOpen && (
        <HamburgerMenu event={event} session={session} readOnly={readOnly} onClose={() => setMenuOpen(false)} onGrid={() => { setMenuOpen(false); }} />
      )}
    </div>
  );
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function HamburgerMenu({
  event, session, readOnly, onClose,
}: { event: MunEvent; session: Session; readOnly: boolean; onClose: () => void; onGrid: () => void }) {
  return (
    <div className="hamburger-menu" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ padding: '4px 8px 12px' }}>
          <strong style={{ color: 'var(--navy)' }}>{event.name}</strong>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose}><IconClose /></button>
        </div>
        <button className="drawer-item" onClick={() => { onClose(); actions.go({ name: 'home', eventId: event.id }); }}>
          <IconGrid size={18} /> Committee home
        </button>
        <button className="drawer-item" onClick={() => { onClose(); actions.openScoreboard(); }}>
          <IconTrophy size={18} /> Scoreboard &amp; ranking
        </button>
        {!readOnly && session.status === 'inProgress' && (
          <button
            className="drawer-item"
            style={{ color: 'var(--red)' }}
            onClick={() => {
              if (confirm('End this session? This unlocks post-session comments and locks the session to review.')) {
                actions.endSession(session.id);
                onClose();
                actions.go({ name: 'home', eventId: event.id });
              }
            }}
          >
            <IconClose size={18} /> End session
          </button>
        )}
      </div>
    </div>
  );
}

export type TabProps = { session: Session; delegates: Delegate[]; readOnly: boolean };
