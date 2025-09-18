import { useCallback, useMemo, useState } from 'react';
import AddKnowledge from './pages/AddKnowledge';
import Refine from './pages/Refine';
import Knowledge from './pages/Knowledge';
import About from './pages/About';
import type { ObjectiveWithRelated, Ticket } from './types/objectives';
import './App.css';

type Tab = 'capture' | 'refine' | 'explore' | 'about';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('capture');
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const hydrateTickets = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const params = new URLSearchParams();
    params.set('ids', ids.join(','));

    try {
      const response = await fetch(`http://localhost:3001/api/objectives/batch?${params.toString()}`);
      if (!response.ok) {
        console.warn('Failed to hydrate tickets with latest relationships');
        return;
      }

      const data: { objectives: ObjectiveWithRelated[] } = await response.json();
      const detailMap = new Map(data.objectives.map((objective) => [objective.id, objective]));

      setTickets((prev) =>
        prev.map((ticket) => {
          const detail = detailMap.get(ticket.id);
          if (!detail) return ticket;

          const mergedTags = Array.from(new Set([...(detail.tags ?? []), ...(ticket.tags ?? [])]));

          return {
            ...ticket,
            text: detail.text,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
            related: detail.related ?? ticket.related,
            tags: mergedTags,
          };
        }),
      );
    } catch (error) {
      console.error('Error hydrating tickets', error);
    }
  }, []);

  const tabs = useMemo(
    () => [
      { id: 'capture' as const, label: 'Capture' },
      { id: 'refine' as const, label: 'Refine' },
      { id: 'explore' as const, label: 'Explore' },
      { id: 'about' as const, label: 'About' },
    ],
    [],
  );

  const handleProcessed = useCallback(
    (nextTickets: Ticket[]) => {
      setTickets(nextTickets);
      setActiveTab('refine');
      void hydrateTickets(nextTickets.map((ticket) => ticket.id));
    },
    [hydrateTickets],
  );

  const handleUpdateTicket = useCallback((index: number, updater: (ticket: Ticket) => Ticket) => {
    setTickets((prev) =>
      prev.map((ticket, ticketIndex) => (ticketIndex === index ? updater(ticket) : ticket)),
    );
  }, []);

  return (
    <div className="app-shell">
      <div className="app-shell__glow" aria-hidden />

      <header className="top-nav">
        <div className="container top-nav__inner">
          <button type="button" className="top-nav__brand" onClick={() => setActiveTab('capture')}>
            Visium
          </button>
          <nav className="top-nav__tabs" aria-label="Primary">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'top-nav__tab top-nav__tab--active' : 'top-nav__tab'}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className={activeTab === 'explore' ? 'main main--canvas' : 'main'}>
        {activeTab === 'explore' ? (
          <Knowledge />
        ) : activeTab === 'about' ? (
          <div className="container main__content">
            <About />
          </div>
        ) : (
          <div className="container main__content">
            {activeTab === 'capture' && <AddKnowledge onProcessed={handleProcessed} />}
            {activeTab === 'refine' && <Refine tickets={tickets} onUpdate={handleUpdateTicket} />}
          </div>
        )}
      </main>

      {activeTab !== 'explore' && (
        <footer className="footer">
          <div className="container footer__inner">
            <div>
              <span className="footer__brand">Visium</span>
              <p>Operational intelligence for ambitious teams.</p>
            </div>
            <div className="footer__links">
              <a href="mailto:hello@visium.ai">Contact</a>
              <a href="https://visium.ai" target="_blank" rel="noreferrer">Website</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
