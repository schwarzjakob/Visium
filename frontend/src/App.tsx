import { useState } from 'react';
import AddKnowledge from './pages/AddKnowledge';
import Knowledge from './pages/Knowledge';
import './App.css';

type Tab = 'add-knowledge' | 'knowledge';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('add-knowledge');

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
              className={activeTab === 'add-knowledge' ? 'hero__tab hero__tab--active' : 'hero__tab'}
              onClick={() => setActiveTab('add-knowledge')}
              type="button"
            >
              Add Knowledge
            </button>
            <button
              className={activeTab === 'knowledge' ? 'hero__tab hero__tab--active' : 'hero__tab'}
              onClick={() => setActiveTab('knowledge')}
              type="button"
            >
              Knowledge
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="container main__content">
          {activeTab === 'add-knowledge' && <AddKnowledge />}
          {activeTab === 'knowledge' && <Knowledge />}
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
