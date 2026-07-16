import { useEffect } from 'react';
import { actions, useStore } from './store/store';
import { CommitteeSetup } from './screens/CommitteeSetup';
import { Home } from './screens/Home';
import { LiveSession } from './screens/LiveSession';
import { Scoreboard } from './screens/Scoreboard';
import { ReviewMode } from './screens/ReviewMode';

export default function App() {
  const hydrated = useStore((s) => s.ui.hydrated);
  const route = useStore((s) => s.ui.route);
  const sbOpen = useStore((s) => s.ui.scoreboard.open);

  useEffect(() => {
    void actions.hydrate();
  }, []);

  // Resolve the event id in context for the scoreboard overlay.
  const scoreboardEventId = useStore((s) => {
    const r = s.ui.route;
    if (r.name === 'home') return r.eventId;
    if (r.name === 'session') {
      const ses = s.data.sessions.find((x) => x.id === r.sessionId);
      return ses?.munEventId ?? null;
    }
    return s.data.events[0]?.id ?? null;
  });

  if (!hydrated) {
    return <div className="app-root" style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>;
  }

  return (
    <>
      {route.name === 'setup' && <CommitteeSetup />}
      {route.name === 'home' && <Home eventId={route.eventId} />}
      {route.name === 'session' && <LiveSession sessionId={route.sessionId} readOnly={route.readOnly} />}
      {route.name === 'review' && <ReviewMode sessionId={route.sessionId} />}
      {sbOpen && scoreboardEventId && route.name !== 'review' && <Scoreboard eventId={scoreboardEventId} />}
    </>
  );
}
