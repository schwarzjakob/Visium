import { useState } from 'react';

interface ObjectiveWithRelated {
  id: string;
  text: string;
  createdAt: string;
  related: Array<{ id: string; text: string }>;
}

interface ExtractResponse {
  objectives: ObjectiveWithRelated[];
  totalInserted: number;
}

export default function AddKnowledge() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ObjectiveWithRelated[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setHasSubmitted(true);

    try {
      const response = await fetch('http://localhost:3001/api/objectives/extract-and-store', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: ExtractResponse = await response.json();
      setResults(data.objectives);

      if (data.totalInserted === 0) {
        setError('No new objectives were extracted from your input. Try adding more specific goals or plans.');
      }
    } catch (err) {
      console.error('Error submitting text:', err);
      setError(err instanceof Error ? err.message : 'Failed to process your input');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value).catch(console.error);
  };

  const showEmptyState = !loading && !error && results.length === 0 && hasSubmitted;

  return (
    <section className="add-knowledge">
      <header className="add-knowledge__header">
        <span className="add-knowledge__eyebrow">Intake Studio</span>
        <h2>Drop in raw knowledge. Visium shapes it into strategic objectives.</h2>
        <p>
          Paste transcripts, meeting notes, or ambitious plans. We extract objectives,
          preserve context, and connect related knowledge instantly.
        </p>
      </header>

      <div className="add-knowledge__layout">
        <article className="panel panel--primary add-knowledge__panel">
          <form onSubmit={handleSubmit} className="add-knowledge__form">
            <label className="sr-only" htmlFor="knowledge-input">
              Raw knowledge input
            </label>
            <textarea
              id="knowledge-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste notes or ideas here…\n\nTry things like:\n• Executive sync notes\n• Product requirement drafts\n• Customer interviews\n• Strategy memos`}
              rows={10}
              className="add-knowledge__textarea"
              disabled={loading}
            />

            <div className="add-knowledge__actions">
              <button type="submit" disabled={loading || !text.trim()}>
                {loading ? 'Extracting…' : 'Extract Objectives'}
              </button>
              <span className="add-knowledge__hint">Secure, on-prem processing · Built for high-trust teams</span>
            </div>
          </form>

          <div className="add-knowledge__chips" aria-hidden>
            <span>Meeting notes</span>
            <span>Vision decks</span>
            <span>Strategy workshops</span>
            <span>Sprint reviews</span>
          </div>
        </article>

        <aside className="panel panel--secondary add-knowledge__aside">
          <h3>How to get crisp objectives</h3>
          <ul>
            <li>Include owners, goals, and measurable signals for each initiative.</li>
            <li>Highlight blockers or dependencies to boost related knowledge suggestions.</li>
            <li>Group related themes together—Visium keeps nuance without losing structure.</li>
          </ul>
          <div className="add-knowledge__stats">
            <div>
              <span className="add-knowledge__stats-value"><strong>35s</strong></span>
              <span className="add-knowledge__stats-label">Median processing time</span>
            </div>
            <div>
              <span className="add-knowledge__stats-value"><strong>92%</strong></span>
              <span className="add-knowledge__stats-label">Objective precision</span>
            </div>
          </div>
        </aside>
      </div>

      {error && (
        <div className="alert" role="alert">
          <span className="alert__badge">Error</span>
          <p>{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <section className="results">
          <header className="results__header">
            <div>
              <span className="results__eyebrow">Objectives ready</span>
              <h3>{results.length} extracted objective{results.length > 1 ? 's' : ''}</h3>
            </div>
            <p>Click any related insight to copy it for follow-up briefs or planning docs.</p>
          </header>

          <div className="results__grid">
            {results.map((objective, index) => (
              <article key={objective.id} className="objective-card">
                <div className="objective-card__badge">Objective {index + 1}</div>
                <p className="objective-card__text">{objective.text}</p>

                {objective.related.length > 0 && (
                  <div className="objective-card__related">
                    <span className="objective-card__related-label">
                      Related knowledge ({objective.related.length})
                    </span>
                    <div className="objective-card__related-list">
                      {objective.related.map((related) => (
                        <button
                          key={related.id}
                          type="button"
                          className="related-chip"
                          onClick={() => copyToClipboard(related.text)}
                        >
                          {related.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {showEmptyState && (
        <div className="empty-state">
          <div className="empty-state__pulse" aria-hidden />
          <p>We received your entry — awaiting data to turn into actionable objectives.</p>
        </div>
      )}
    </section>
  );
}
