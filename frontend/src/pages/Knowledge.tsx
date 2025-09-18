import { useEffect, useMemo, useState } from 'react';

type ObjectiveStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED' | 'ARCHIVED' | string;

type GraphObjective = {
  id: string;
  text: string;
  status: ObjectiveStatus;
  priority: string | null;
  createdAt: string;
};

type GraphRelationship = {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  rationale: string | null;
  weight: number | null;
};

type GraphSnapshot = {
  objectives: GraphObjective[];
  relationships: GraphRelationship[];
};

interface LayoutNode extends GraphObjective {
  x: number;
  y: number;
}

const GRAPH_SIZE = 520;
const NODE_LIMIT = 14;

function statusColor(status: ObjectiveStatus): string {
  switch (status) {
    case 'COMPLETE':
      return 'rgba(43, 216, 137, 0.85)';
    case 'IN_PROGRESS':
      return 'rgba(24, 211, 255, 0.85)';
    case 'BLOCKED':
      return 'rgba(255, 122, 122, 0.85)';
    default:
      return 'rgba(124, 92, 255, 0.85)';
  }
}

export default function Knowledge() {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSnapshot = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('http://localhost:3001/api/objectives/graph');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        const data: GraphSnapshot = await response.json();
        setSnapshot(data);
        if (data.objectives.length > 0) {
          setSelectedId(data.objectives[0].id);
        }
      } catch (err) {
        console.error('Error loading knowledge graph:', err);
        setError(err instanceof Error ? err.message : 'Failed to load knowledge graph');
      } finally {
        setLoading(false);
      }
    };

    void fetchSnapshot();
  }, []);

  const layout = useMemo(() => {
    if (!snapshot || snapshot.objectives.length === 0) {
      return { nodes: [] as LayoutNode[], relationships: [] as GraphRelationship[] };
    }

    const objectives = snapshot.objectives.slice(0, NODE_LIMIT);
    const radius = GRAPH_SIZE / 2 - 40;
    const center = GRAPH_SIZE / 2;

    const nodes: LayoutNode[] = objectives.map((objective, index) => {
      const angle = (index / objectives.length) * Math.PI * 2;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);

      return {
        ...objective,
        x,
        y,
      };
    });

    const ids = new Set(nodes.map((node) => node.id));
    const relationships = snapshot.relationships.filter(
      (relationship) => ids.has(relationship.fromId) && ids.has(relationship.toId),
    );

    return { nodes, relationships };
  }, [snapshot]);

  const selectedNode = useMemo(
    () => layout.nodes.find((node) => node.id === selectedId) ?? null,
    [layout.nodes, selectedId],
  );

  const nodeById = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    layout.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [layout.nodes]);

  const relationshipsForSelected = useMemo(() => {
    if (!selectedNode) return [] as GraphRelationship[];
    return layout.relationships.filter(
      (relationship) => relationship.fromId === selectedNode.id || relationship.toId === selectedNode.id,
    );
  }, [layout.relationships, selectedNode]);

  return (
    <section className="knowledge">
      <header className="knowledge__header">
        <span className="knowledge__eyebrow">Explore</span>
        <h2>Visualize how knowledge connects across the objective graph.</h2>
        <p>
          Inspect relationships, spot emerging clusters, and trace the rationale linking initiatives. The
          graph updates whenever new knowledge is captured.
        </p>
      </header>

      <div className="knowledge__grid">
        <article className="panel panel--primary knowledge__panel">
          <h3>Knowledge graph</h3>
          {loading && <p>Loading knowledge graph…</p>}
          {error && <p className="knowledge__error">{error}</p>}

          {!loading && !error && layout.nodes.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__pulse" aria-hidden />
              <p>No objectives in the graph yet. Capture knowledge to seed the network.</p>
            </div>
          )}

          {!loading && !error && layout.nodes.length > 0 && (
            <div className="knowledge-graph" role="presentation">
              <svg viewBox={`0 0 ${GRAPH_SIZE} ${GRAPH_SIZE}`}>
                <defs>
                  <radialGradient id="nodeGlow" fx="50%" fy="50%">
                    <stop offset="0%" stopColor="rgba(255, 255, 255, 0.95)" />
                    <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                  </radialGradient>
                </defs>

                {layout.relationships.map((relationship) => {
                  const from = nodeById.get(relationship.fromId);
                  const to = nodeById.get(relationship.toId);
                  if (!from || !to) return null;

                  return (
                    <line
                      key={relationship.id}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="rgba(124, 92, 255, 0.22)"
                      strokeWidth={relationship.weight ? Math.max(1, relationship.weight) : 1}
                    />
                  );
                })}

                {layout.nodes.map((node) => {
                  const isActive = node.id === selectedId;
                  return (
                    <g key={node.id} onClick={() => setSelectedId(node.id)} className="knowledge-graph__node">
                      <circle cx={node.x} cy={node.y} r={isActive ? 20 : 16} fill={statusColor(node.status)} />
                      {isActive && <circle cx={node.x} cy={node.y} r={32} fill="url(#nodeGlow)" opacity={0.35} />}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </article>

        <aside className="panel panel--secondary knowledge__panel">
          <h3>Relationship detail</h3>
          {selectedNode ? (
            <div className="knowledge__detail">
              <div className="knowledge__detail-header">
                <span className="knowledge__metric">{selectedNode.status.replace('_', ' ')}</span>
                <p>{new Date(selectedNode.createdAt).toLocaleDateString()}</p>
              </div>
              <p className="knowledge__selected-text">{selectedNode.text}</p>

              <div className="knowledge__relations">
                <h4>Connections</h4>
                {relationshipsForSelected.length === 0 && <p>No direct links recorded yet.</p>}
                {relationshipsForSelected.length > 0 && (
                  <ul>
                    {relationshipsForSelected.map((relationship) => {
                      const targetId = relationship.fromId === selectedNode.id ? relationship.toId : relationship.fromId;
                      const target = nodeById.get(targetId);
                      if (!target) return null;

                      return (
                        <li key={relationship.id}>
                          <span className="knowledge__relation-type">{relationship.type}</span>
                          <p>{target.text}</p>
                          {relationship.rationale && (
                            <small className="knowledge__relation-note">{relationship.rationale}</small>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p>Select a node in the graph to inspect its context and connections.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
