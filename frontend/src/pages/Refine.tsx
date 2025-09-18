import { useEffect, useMemo, useState } from 'react';
import type { Ticket, TicketStatus } from '../types/objectives';

interface RefineProps {
  tickets: Ticket[];
  onUpdate: (index: number, updater: (ticket: Ticket) => Ticket) => void;
}

export default function Refine({ tickets, onUpdate }: RefineProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');

  useEffect(() => {
    if (tickets.length === 0) {
      setCurrentIndex(0);
      setIsEditing(false);
      setDraftText('');
      return;
    }

    if (currentIndex >= tickets.length) {
      setCurrentIndex(tickets.length - 1);
      setIsEditing(false);
      setDraftText('');
    }
  }, [tickets, currentIndex]);

  const currentTicket = tickets[currentIndex] ?? null;
  const reviewComplete = tickets.length > 0 && tickets.every((ticket) => ticket.status !== 'pending');
  const hasTickets = tickets.length > 0;

  const progressDots = useMemo(
    () =>
      tickets.map((ticket) => ({
        id: ticket.id,
        status: ticket.status,
      })),
    [tickets],
  );

  const goToTicket = (index: number) => {
    if (index < 0 || index >= tickets.length) return;
    setCurrentIndex(index);
    setIsEditing(false);
    setDraftText('');
  };

  const goToNext = () => {
    if (currentIndex < tickets.length - 1) {
      goToTicket(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      goToTicket(currentIndex - 1);
    }
  };

  const updateStatus = (status: TicketStatus) => {
    if (!currentTicket) return;

    onUpdate(currentIndex, (ticket) => ({
      ...ticket,
      status,
    }));

    setIsEditing(false);
    setDraftText('');

    if (currentIndex < tickets.length - 1) {
      goToNext();
    }
  };

  const handleEditStart = () => {
    if (!currentTicket) return;
    setIsEditing(true);
    setDraftText(currentTicket.text);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setDraftText('');
  };

  const handleEditSave = () => {
    if (!currentTicket) return;
    if (!draftText.trim()) return;

    onUpdate(currentIndex, (ticket) => ({
      ...ticket,
      text: draftText.trim(),
      status: 'pending',
    }));

    setIsEditing(false);
    setDraftText('');
  };

  if (!hasTickets) {
    return (
      <section className="tickets tickets--empty">
        <div className="empty-state">
          <div className="empty-state__pulse" aria-hidden />
          <p>No captured objectives ready for review yet. Head to Capture to add more knowledge.</p>
        </div>
      </section>
    );
  }

  if (!currentTicket) {
    return null;
  }

  const isTicketActionDisabled = currentTicket.status !== 'pending';

  return (
    <section className="tickets">
      <header className="tickets__header">
        <div>
          <span className="tickets__eyebrow">Refine</span>
          <h3>
            Ticket {currentIndex + 1} of {tickets.length}
          </h3>
        </div>
        <div className="tickets__progress" aria-hidden>
          {progressDots.map((dot, index) => (
            <span
              key={dot.id}
              className={`tickets__dot tickets__dot--${dot.status} ${
                index === currentIndex ? 'tickets__dot--active' : ''
              }`}
            />
          ))}
        </div>
      </header>

      <article className="tickets__card" aria-live="polite">
        <div className="tickets__status">
          <span className={`tickets__badge tickets__badge--${currentTicket.status}`}>
            {currentTicket.status === 'pending'
              ? 'Awaiting review'
              : currentTicket.status === 'accepted'
              ? 'Accepted'
              : 'Discarded'}
          </span>
          <span className="tickets__timestamp">
            Captured {new Date(currentTicket.createdAt).toLocaleString()}
          </span>
        </div>

        {isEditing ? (
          <textarea
            className="tickets__editor"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            rows={6}
          />
        ) : (
          <p className="tickets__text">{currentTicket.text}</p>
        )}

        {currentTicket.related.length > 0 && (
          <div className="tickets__related">
            <span className="tickets__related-label">Related knowledge</span>
            <ul>
              {currentTicket.related.map((related) => (
                <li key={related.id}>{related.text}</li>
              ))}
            </ul>
          </div>
        )}

        <footer className="tickets__actions">
          {isEditing ? (
            <>
              <button type="button" onClick={handleEditSave} disabled={!draftText.trim()}>
                Save changes
              </button>
              <button type="button" onClick={handleEditCancel} className="tickets__secondary">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => updateStatus('accepted')} disabled={isTicketActionDisabled}>
                Accept
              </button>
              <button type="button" onClick={handleEditStart} className="tickets__secondary">
                Edit
              </button>
              <button
                type="button"
                onClick={() => updateStatus('discarded')}
                className="tickets__secondary tickets__secondary--danger"
                disabled={isTicketActionDisabled}
              >
                Discard
              </button>
            </>
          )}
        </footer>
      </article>

      <div className="tickets__navigation">
        <button
          type="button"
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="tickets__secondary"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={goToNext}
          disabled={currentIndex >= tickets.length - 1}
          className="tickets__secondary"
        >
          Next
        </button>
      </div>

      {reviewComplete && (
        <div className="tickets__summary" role="status">
          <p>All tickets reviewed. Sync, export, or revisit anything from the Knowledge graph.</p>
        </div>
      )}
    </section>
  );
}
