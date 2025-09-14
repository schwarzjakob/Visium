import { useState } from 'react';
import AddKnowledge from './pages/AddKnowledge';
import Knowledge from './pages/Knowledge';
import './App.css';

type Tab = 'add-knowledge' | 'knowledge';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('add-knowledge');

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <h1>Visium</h1>
          <nav className="tabs">
            <button
              className={activeTab === 'add-knowledge' ? 'tab-active' : 'tab'}
              onClick={() => setActiveTab('add-knowledge')}
            >
              Add Knowledge
            </button>
            <button
              className={activeTab === 'knowledge' ? 'tab-active' : 'tab'}
              onClick={() => setActiveTab('knowledge')}
            >
              Knowledge
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          {activeTab === 'add-knowledge' && <AddKnowledge />}
          {activeTab === 'knowledge' && <Knowledge />}
        </div>
      </main>
    </div>
  );
}

export default App;
