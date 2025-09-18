import { useCallback, useState } from 'react';
import AddKnowledge from './pages/AddKnowledge';
import Refine from './pages/Refine';
import Knowledge from './pages/Knowledge';
import type { Ticket } from './types/objectives';
import './App.css';

type Tab = 'capture' | 'refine' | 'explore';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('capture');
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const handleProcessed = useCallback((nextTickets: Ticket[]) => {
    setTickets(nextTickets);
    setActiveTab('refine');
  }, []);

  const handleUpdateTicket = useCallback((index: number, updater: (ticket: Ticket) => Ticket) => {
    setTickets((prev) =>
      prev.map((ticket, ticketIndex) => (ticketIndex === index ? updater(ticket) : ticket)),
    );
  }, []);

  return (
    <div className="app-shell">
      <div className="app-shell__glow" aria-hidden />

      <header className="hero">
        <div className="container hero__inner">
          <div className="hero__content">
            <span className="hero__pill">Knowledge operating system</span>
            <h1>Visium</h1>
            <p>
              Transform unstructured notes into a living objective graph. Collect, refine, and
              explore institutional knowledge in one beautiful workspace.
            </p>
          </div>

          <nav className="hero__tabs" aria-label="Primary">
            <button
              className={activeTab === 'capture' ? 'hero__tab hero__tab--active' : 'hero__tab'}
              onClick={() => setActiveTab('capture')}
              type="button"
            >
              Capture
            </button>
            <button
              className={activeTab === 'refine' ? 'hero__tab hero__tab--active' : 'hero__tab'}
              onClick={() => setActiveTab('refine')}
              type="button"
            >
              Refine
            </button>
            <button
              className={activeTab === 'explore' ? 'hero__tab hero__tab--active' : 'hero__tab'}
              onClick={() => setActiveTab('explore')}
              type="button"
            >
              Explore
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="container main__content">
          {activeTab === 'capture' && <AddKnowledge onProcessed={handleProcessed} />}
          {activeTab === 'refine' && <Refine tickets={tickets} onUpdate={handleUpdateTicket} />}
          {activeTab === 'explore' && <Knowledge />}
        </div>
      </main>

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
    </div>
  );
}

export default App;
