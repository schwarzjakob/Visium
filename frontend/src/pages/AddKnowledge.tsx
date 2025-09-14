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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error);
  };

  return (
    <div className="add-knowledge">
      <h2>Add Knowledge</h2>
      <p>Paste your notes, discussions, or ideas below. Visium will extract clear objectives and show related knowledge.</p>

      <form onSubmit={handleSubmit} className="input-form">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste notes or ideas here...

For example:
• Meeting notes from strategy session
• Project plans and goals  
• Discussion transcripts
• Brainstorming outputs"
          rows={8}
          className="text-input"
          disabled={loading}
        />
        
        <button type="submit" disabled={loading || !text.trim()}>
          {loading ? 'Processing...' : 'Extract Objectives'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="results">
          <h3>Extracted Objectives ({results.length})</h3>
          <div className="objectives-list">
            {results.map((objective) => (
              <div key={objective.id} className="objective-card">
                <div className="objective-text">
                  {objective.text}
                </div>
                
                {objective.related.length > 0 && (
                  <div className="related-section">
                    <details className="related-details">
                      <summary className="related-badge">
                        Related ({objective.related.length})
                      </summary>
                      <div className="related-list">
                        {objective.related.map((related) => (
                          <div 
                            key={related.id} 
                            className="related-item"
                            onClick={() => copyToClipboard(related.text)}
                            title="Click to copy"
                          >
                            {related.text}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && results.length === 0 && text.trim() && (
        <div className="empty-state">
          <p>Submit your text above to extract objectives.</p>
        </div>
      )}
    </div>
  );
}