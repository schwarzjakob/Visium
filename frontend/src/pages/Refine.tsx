import { useEffect, useMemo, useState } from 'react';
import type {
  ObjectiveRelatedItem,
  ObjectiveRelationTarget,
  Ticket,
  TicketStatus,
} from '../types/objectives';

interface RefineProps {
  tickets: Ticket[];
  onUpdate: (index: number, updater: (ticket: Ticket) => Ticket) => void;
}

const RELATIONSHIP_TYPES = ['SUPPORTS', 'DEPENDS_ON', 'RELATES_TO', 'BLOCKS', 'INFORMS'] as const;

type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

interface RelationshipApiResponse {
  id: string;
  type: RelationshipType;
  rationale: string | null;
  weight: number | null;
  target: ObjectiveRelationTarget;
}

interface RelationshipCreateResponse {
  fromId: string;
  relationship: RelationshipApiResponse;
}

interface RelationshipDeleteResponse {
  id: string;
  fromId: string;
}

type ObjectiveSuggestion = ObjectiveRelationTarget;

interface RelationshipFormState {
  mode: 'add' | 'edit';
  relationshipId?: string;
  targetId: string;
  targetText: string;
  type: RelationshipType;
  rationale: string;
}

function mapRelationshipFromApi(relationship: RelationshipApiResponse): ObjectiveRelatedItem {
  return {
    id: relationship.id,
    type: relationship.type,
    rationale: relationship.rationale,
    weight: relationship.weight,
    target: {
      id: relationship.target.id,
      text: relationship.target.text,
      status: relationship.target.status,
      priority: relationship.target.priority,
    },
  } satisfies ObjectiveRelatedItem;
}

function relationshipTypeLabel(value?: string) {
  if (!value) return 'Linked objective';
  return value.replace(/_/g, ' ');
}

export default function Refine({ tickets, onUpdate }: RefineProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [relationshipForm, setRelationshipForm] = useState<RelationshipFormState | null>(null);
  const [relationshipSuggestions, setRelationshipSuggestions] = useState<ObjectiveSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const [relationshipSaving, setRelationshipSaving] = useState(false);
  const [relationshipSearchQuery, setRelationshipSearchQuery] = useState('');

  useEffect(() => {
    if (tickets.length === 0) {
      setCurrentIndex(0);
      setIsEditing(false);
      setDraftText('');
      setRelationshipForm(null);
      return;
    }

    if (currentIndex >= tickets.length) {
      setCurrentIndex(tickets.length - 1);
      setIsEditing(false);
      setDraftText('');
      setRelationshipForm(null);
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

  useEffect(() => {
    setRelationshipForm(null);
    setRelationshipError(null);
    setRelationshipSearchQuery('');
  }, [currentIndex]);

  useEffect(() => {
    if (!relationshipForm) {
      setRelationshipSuggestions([]);
      return;
    }

    const query = relationshipSearchQuery.trim();
    if (query.length < 2) {
      setRelationshipSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setSuggestionsLoading(true);

    const fetchSuggestions = async () => {
      try {
        const params = new URLSearchParams({ query, limit: '10' });
        const response = await fetch(`http://localhost:3001/api/objectives?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: { objectives: Array<{ id: string; text: string; status: string; priority: string | null }> } =
          await response.json();
        if (!cancelled) {
          const filtered = data.objectives.filter((objective) => objective.id !== currentTicket?.id);
          setRelationshipSuggestions(filtered);
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Error searching objectives', error);
          setRelationshipSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    };

    void fetchSuggestions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [relationshipForm, relationshipSearchQuery, currentTicket?.id]);

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

  const openAddRelationship = () => {
    if (!currentTicket) return;
    setRelationshipForm({
      mode: 'add',
      targetId: '',
      targetText: '',
      type: 'RELATES_TO',
      rationale: '',
    });
    setRelationshipSearchQuery('');
    setRelationshipError(null);
  };

  const openEditRelationship = (relationship: ObjectiveRelatedItem) => {
    setRelationshipForm({
      mode: 'edit',
      relationshipId: relationship.id,
      targetId: relationship.target.id,
      targetText: relationship.target.text,
      type: (relationship.type as RelationshipType) ?? 'RELATES_TO',
      rationale: relationship.rationale ?? '',
    });
    setRelationshipSearchQuery(relationship.target.text);
    setRelationshipError(null);
  };

  const closeRelationshipForm = () => {
    setRelationshipForm(null);
    setRelationshipError(null);
    setRelationshipSuggestions([]);
    setRelationshipSearchQuery('');
  };

  const handleRelationshipFieldChange = <K extends keyof RelationshipFormState>(key: K, value: RelationshipFormState[K]) => {
    setRelationshipForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleRelationshipSave = async () => {
    if (!currentTicket || !relationshipForm) return;

    if (!relationshipForm.targetId) {
      setRelationshipError('Select a target objective to create the relationship.');
      return;
    }

    setRelationshipSaving(true);
    setRelationshipError(null);

    try {
      const trimmedRationale = relationshipForm.rationale.trim();
      if (relationshipForm.mode === 'add') {
        const response = await fetch('http://localhost:3001/api/objectives/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromId: currentTicket.id,
            toId: relationshipForm.targetId,
            type: relationshipForm.type,
            rationale: trimmedRationale.length > 0 ? trimmedRationale : null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result: RelationshipCreateResponse = await response.json();
        if (result.fromId === currentTicket.id) {
          onUpdate(currentIndex, (ticket) => ({
            ...ticket,
            related: [...ticket.related, mapRelationshipFromApi(result.relationship)],
          }));
        }
      } else {
        if (!relationshipForm.relationshipId) {
          throw new Error('Relationship id is missing');
        }
        const response = await fetch(`http://localhost:3001/api/objectives/relationships/${relationshipForm.relationshipId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toId: relationshipForm.targetId,
            type: relationshipForm.type,
            rationale: trimmedRationale.length > 0 ? trimmedRationale : null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result: RelationshipCreateResponse = await response.json();
        if (result.fromId === currentTicket.id) {
          onUpdate(currentIndex, (ticket) => ({
            ...ticket,
            related: ticket.related.map((relation) =>
              relation.id === result.relationship.id ? mapRelationshipFromApi(result.relationship) : relation,
            ),
          }));
        }
      }

      closeRelationshipForm();
    } catch (error) {
      console.error('Relationship save error', error);
      setRelationshipError(error instanceof Error ? error.message : 'Failed to save relationship');
    } finally {
      setRelationshipSaving(false);
    }
  };

  const handleRelationshipDelete = async (relationshipId: string) => {
    if (!currentTicket) return;

    try {
      setRelationshipError(null);
      const response = await fetch(`http://localhost:3001/api/objectives/relationships/${relationshipId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: RelationshipDeleteResponse = await response.json();
      if (result.fromId === currentTicket.id) {
        onUpdate(currentIndex, (ticket) => ({
          ...ticket,
          related: ticket.related.filter((relation) => relation.id !== relationshipId),
        }));
      }
    } catch (error) {
      console.error('Relationship delete error', error);
      setRelationshipError(error instanceof Error ? error.message : 'Failed to delete relationship');
    }
  };

  if (!hasTickets) {
    return (
      <section className="refine">
        <header className="refine__header">
          <span className="refine__eyebrow">Refine</span>
          <h2>Review and link extracted objectives</h2>
          <p>Accept, edit, or relate each objective before it becomes part of the live knowledge graph.</p>
        </header>

        <section className="tickets tickets--empty">
          <div className="empty-state">
            <div className="empty-state__pulse" aria-hidden />
            <p>No captured objectives ready for review yet. Head to Capture to add more knowledge.</p>
          </div>
        </section>
      </section>
    );
  }

  if (!currentTicket) {
    return null;
  }

  const isTicketActionDisabled = currentTicket.status !== 'pending';

  return (
    <section className="refine">
      <header className="refine__header">
        <span className="refine__eyebrow">Refine</span>
        <h2>Review and link extracted objectives</h2>
        <p>Accept, edit, or relate each objective before it becomes part of the live knowledge graph.</p>
      </header>

      <section className="tickets">
        <header className="tickets__header">
          <div>
            <span className="tickets__eyebrow">Review queue</span>
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

        {currentTicket.tags.length > 0 && !isEditing && (
          <div className="tickets__tags" aria-label="Tags">
            {currentTicket.tags.map((tag) => (
              <span key={tag} className="tickets__tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="tickets__related">
          <span className="tickets__related-label">Related knowledge</span>

          {relationshipError && !relationshipForm && <p className="tickets__relation-error">{relationshipError}</p>}

          {currentTicket.related.length > 0 ? (
            <ul>
              {currentTicket.related.map((related) => (
                <li key={related.id}>
                  <div>
                    <strong>{relationshipTypeLabel(related.type)}</strong>
                    <p>{related.target.text}</p>
                    {related.rationale && <small>{related.rationale}</small>}
                  </div>
                  <div className="tickets__relation-actions">
                    <button type="button" className="tickets__secondary" onClick={() => openEditRelationship(related)}>
                      Edit link
                    </button>
                    <button
                      type="button"
                      className="tickets__secondary tickets__secondary--danger"
                      onClick={() => handleRelationshipDelete(related.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tickets__related-empty">No relationships yet.</p>
          )}

          {relationshipForm && (
            <div className="tickets__relation-form">
              <h4>{relationshipForm.mode === 'add' ? 'Add relationship' : 'Edit relationship'}</h4>

              <label className="tickets__relation-label" htmlFor="relationship-type">
                Relationship type
              </label>
              <select
                id="relationship-type"
                value={relationshipForm.type}
                onChange={(event) => handleRelationshipFieldChange('type', event.target.value as RelationshipType)}
              >
                {RELATIONSHIP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {relationshipTypeLabel(type)}
                  </option>
                ))}
              </select>

              <label className="tickets__relation-label" htmlFor="relationship-target">
                Target objective
              </label>
              <input
                id="relationship-target"
                type="text"
                placeholder="Search objectives…"
                value={relationshipSearchQuery}
                onChange={(event) => {
                  setRelationshipSearchQuery(event.target.value);
                }}
              />

              {suggestionsLoading && <p className="tickets__relation-hint">Searching…</p>}

              {!suggestionsLoading && relationshipSuggestions.length > 0 && (
                <ul className="tickets__relation-suggestions">
                  {relationshipSuggestions.map((suggestion) => (
                    <li key={suggestion.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setRelationshipForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  targetId: suggestion.id,
                                  targetText: suggestion.text,
                                }
                              : prev,
                          );
                          setRelationshipSearchQuery(suggestion.text);
                        }}
                      >
                        <span>{suggestion.text}</span>
                        <small>{suggestion.status}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {relationshipForm.targetId && (
                <p className="tickets__relation-selected">
                  Selected: <strong>{relationshipForm.targetText}</strong>
                </p>
              )}

              <label className="tickets__relation-label" htmlFor="relationship-rationale">
                Rationale (optional)
              </label>
              <textarea
                id="relationship-rationale"
                rows={3}
                placeholder="Explain why these objectives connect…"
                value={relationshipForm.rationale}
                onChange={(event) => handleRelationshipFieldChange('rationale', event.target.value)}
              />

              {relationshipError && <p className="tickets__relation-error">{relationshipError}</p>}

              <div className="tickets__relation-buttons">
                <button type="button" onClick={handleRelationshipSave} disabled={relationshipSaving}>
                  {relationshipSaving ? 'Saving…' : 'Save link'}
                </button>
                <button type="button" className="tickets__secondary" onClick={closeRelationshipForm} disabled={relationshipSaving}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!relationshipForm && (
            <button type="button" className="tickets__secondary" onClick={openAddRelationship}>
              Add relationship
            </button>
          )}
        </div>

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
    </section>
  );
}
