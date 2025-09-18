import { useMemo, useState } from 'react';
import type { ObjectiveWithRelated, Ticket } from '../types/objectives';

interface ExtractResponse {
  objectives: ObjectiveWithRelated[];
  totalInserted: number;
}

interface AddKnowledgeProps {
  onProcessed: (tickets: Ticket[]) => void;
}

export default function AddKnowledge({ onProcessed }: AddKnowledgeProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProcessedCount, setLastProcessedCount] = useState<number | null>(null);

  const placeholder = useMemo(
    () =>
      `Drop the raw signal…\n\nTry:\n• Weekly leadership sync notes\n• Fresh customer interview quotes\n• Strategy doc bullet points\n• Sprint or roadmap review takeaways`,
    [],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setLastProcessedCount(null);

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
      const preparedTickets = data.objectives.map<Ticket>((objective) => ({
        ...objective,
        originalText: objective.text,
        status: 'pending',
      }));

      if (preparedTickets.length === 0) {
        setError('No new objectives were extracted from your input. Try adding more specific goals or plans.');
      } else {
        onProcessed(preparedTickets);
        setLastProcessedCount(preparedTickets.length);
        setText('');
      }
    } catch (err) {
      console.error('Error submitting text:', err);
      setError(err instanceof Error ? err.message : 'Failed to process your input');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setText('');
    setError(null);
    setLastProcessedCount(null);
  };

  const showSuccess = !loading && !error && lastProcessedCount !== null;

  return (
    <section className="intake">
      <header className="intake__header">
        <span className="intake__eyebrow">Capture</span>
        <h2>Paste the truth, capture the objective.</h2>
        <p>
          This workspace is built for raw context. Drop in transcripts, notes, or signals — Visium will
          parse it into living tickets tied to your objective graph.
        </p>
      </header>

      <div className="intake__surface">
        <div className="intake__panel" role="form">
          <form className="intake__form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="knowledge-input">
              Paste knowledge
            </label>
            <textarea
              id="knowledge-input"
              value={text}
              placeholder={placeholder}
              onChange={(event) => setText(event.target.value)}
              disabled={loading}
              rows={10}
            />
            <div className="intake__actions">
              <button type="submit" disabled={loading || !text.trim()}>
                {loading ? 'Processing…' : 'Send to Visium'}
              </button>
              {text && (
                <button type="button" className="intake__reset" onClick={handleReset} disabled={loading}>
                  Clear input
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {error && (
        <div className="alert" role="alert">
          <span className="alert__badge">Error</span>
          <p>{error}</p>
        </div>
      )}

      {showSuccess && (
        <div className="empty-state" role="status">
          <div className="empty-state__pulse" aria-hidden />
          <p>
            Captured {lastProcessedCount} objective{lastProcessedCount === 1 ? '' : 's'}. Head over to Refine to
            review them.
          </p>
        </div>
      )}
    </section>
  );
}
