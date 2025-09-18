import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface GraphObjective {
  id: string;
  text: string;
  status: string;
  priority: string | null;
  createdAt: string;
  tags?: string[];
}

interface GraphRelationship {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  rationale: string | null;
  weight: number | null;
}

interface GraphSnapshot {
  objectives: GraphObjective[];
  relationships: GraphRelationship[];
}

interface PopoverRelation {
  id: string;
  type: string;
  rationale: string | null;
  target: GraphObjective;
}

type FlowNode = Node<{ label: string; status: string; objective: GraphObjective }>;
type FlowEdge = Edge;

const GRAPH_SIZE = 1600;
const NODE_LIMIT = 24;
const RELATIONSHIP_TYPES = ['SUPPORTS', 'DEPENDS_ON', 'RELATES_TO', 'BLOCKS', 'INFORMS'] as const;
type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
const reactFlowStyle: CSSProperties = { width: '100%', height: '100%' };

function statusColor(status: string): string {
  switch (status?.toUpperCase()) {
    case 'COMPLETE':
      return 'rgba(43, 216, 137, 0.9)';
    case 'IN_PROGRESS':
    case 'IN PROGRESS':
      return 'rgba(24, 211, 255, 0.9)';
    case 'BLOCKED':
      return 'rgba(255, 122, 122, 0.9)';
    default:
      return 'rgba(124, 92, 255, 0.9)';
  }
}

const defaultNodeStyle: CSSProperties = {
  padding: '12px 16px',
  borderRadius: '18px',
  color: '#f7f8fb',
  border: '1px solid rgba(124, 92, 255, 0.35)',
  fontSize: '0.85rem',
  lineHeight: 1.5,
  background: 'rgba(10, 16, 28, 0.85)',
  boxShadow: '0 18px 40px -28px rgba(7, 12, 27, 0.85)',
  maxWidth: 280,
};

const defaultEdgeOptions: Partial<FlowEdge> = {
  type: 'smoothstep',
  animated: false,
  style: { stroke: 'rgba(124, 92, 255, 0.35)', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color: 'rgba(124, 92, 255, 0.35)',
  },
};

export default function Knowledge() {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [connectionForm, setConnectionForm] = useState<{
    sourceId: string;
    targetId: string;
    type: RelationshipType;
    rationale: string;
  } | null>(null);
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const refreshSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConnectionError(null);
    try {
      const response = await fetch('http://localhost:3001/api/objectives/graph');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data: GraphSnapshot = await response.json();
      setSnapshot(data);
      if (data.objectives.length === 0) {
        setSelectedId(null);
      }
    } catch (err) {
      console.error('Error loading knowledge graph:', err);
      setError(err instanceof Error ? err.message : 'Failed to load knowledge graph');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  const objectivesInView = useMemo(() => {
    if (!snapshot) return [] as GraphObjective[];
    return snapshot.objectives.slice(0, NODE_LIMIT);
  }, [snapshot]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphObjective>();
    objectivesInView.forEach((objective) => map.set(objective.id, objective));
    return map;
  }, [objectivesInView]);

  const relationshipsInView = useMemo(() => {
    if (!snapshot) return [] as GraphRelationship[];
    const valid = new Set(objectivesInView.map((objective) => objective.id));
    return snapshot.relationships.filter(
      (relationship) => valid.has(relationship.fromId) && valid.has(relationship.toId),
    );
  }, [snapshot, objectivesInView]);

  useEffect(() => {
    if (!selectedId && objectivesInView.length > 0) {
      setSelectedId(objectivesInView[0].id);
    } else if (selectedId && !nodeMap.has(selectedId)) {
      setSelectedId(objectivesInView[0]?.id ?? null);
    }
  }, [objectivesInView, nodeMap, selectedId]);

  useEffect(() => {
    if (objectivesInView.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const radius = GRAPH_SIZE / 2 - 120;
    const center = GRAPH_SIZE / 2;

    setNodes((prevNodes) => {
      const previousNodes = new Map(prevNodes.map((node) => [node.id, node]));

      return objectivesInView.map((objective, index) => {
        const angle = (index / objectivesInView.length) * Math.PI * 2;
        const fallbackPosition = {
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle),
        };
        const existing = previousNodes.get(objective.id);
        const isActive = objective.id === selectedId;
        const color = statusColor(objective.status);

        return {
          id: objective.id,
          position: existing ? existing.position : fallbackPosition,
          data: {
            label: objective.text,
            status: objective.status,
            objective,
          },
          style: {
            ...defaultNodeStyle,
            border: `1px solid ${isActive ? color : 'rgba(124, 92, 255, 0.35)'}`,
            boxShadow: isActive
              ? '0 25px 55px -25px rgba(24, 211, 255, 0.55)'
              : defaultNodeStyle.boxShadow,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        } satisfies FlowNode;
      });
    });

    const updatedEdges: FlowEdge[] = relationshipsInView.map((relationship) => ({
      ...(defaultEdgeOptions as FlowEdge),
      id: relationship.id,
      source: relationship.fromId,
      target: relationship.toId,
      animated: selectedId === relationship.fromId || selectedId === relationship.toId,
      style: {
        ...defaultEdgeOptions.style,
        stroke:
          selectedId === relationship.fromId || selectedId === relationship.toId
            ? 'rgba(24, 211, 255, 0.6)'
            : 'rgba(124, 92, 255, 0.25)',
      },
    }));

    setEdges(updatedEdges);
  }, [objectivesInView, relationshipsInView, selectedId]);

  const selectedObjective = selectedId ? nodeMap.get(selectedId) ?? null : null;

  const popoverRelations = useMemo(() => {
    if (!selectedObjective) return [] as PopoverRelation[];
    if (!snapshot) return [] as PopoverRelation[];

    const related = snapshot.relationships.filter(
      (relationship) => relationship.fromId === selectedObjective.id || relationship.toId === selectedObjective.id,
    );

    return related
      .map((relationship) => {
        const targetId = relationship.fromId === selectedObjective.id ? relationship.toId : relationship.fromId;
        const target = snapshot.objectives.find((objective) => objective.id === targetId);
        if (!target) return null;
        return {
          id: relationship.id,
          type: relationship.type,
          rationale: relationship.rationale,
          target,
        } satisfies PopoverRelation;
      })
      .filter((value): value is PopoverRelation => Boolean(value));
  }, [selectedObjective, snapshot]);

  const onNodeClick = useCallback((_: unknown, node: FlowNode) => {
    setSelectedId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
    setConnectionForm(null);
    setConnectionError(null);
  }, []);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) {
      setConnectionError('Choose two different objectives to create a relationship.');
      return;
    }
    setConnectionForm({
      sourceId: connection.source,
      targetId: connection.target,
      type: 'RELATES_TO',
      rationale: '',
    });
    setConnectionError(null);
  }, []);

  const handleConnectionSave = useCallback(async () => {
    if (!connectionForm) return;
    setConnectionSaving(true);
    setConnectionError(null);

    try {
      const response = await fetch('http://localhost:3001/api/objectives/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: connectionForm.sourceId,
          toId: connectionForm.targetId,
          type: connectionForm.type,
          rationale: connectionForm.rationale.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      await refreshSnapshot();
      setConnectionForm(null);
      setSelectedId(connectionForm.sourceId);
    } catch (err) {
      console.error('Connection save error', err);
      setConnectionError(err instanceof Error ? err.message : 'Failed to create relationship');
    } finally {
      setConnectionSaving(false);
    }
  }, [connectionForm, refreshSnapshot]);

  const handleConnectionCancel = useCallback(() => {
    setConnectionForm(null);
    setConnectionError(null);
  }, []);

  const handleRelationDelete = useCallback(
    async (relationshipId: string) => {
      setConnectionError(null);
      try {
        const response = await fetch(`http://localhost:3001/api/objectives/relationships/${relationshipId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        await refreshSnapshot();
      } catch (err) {
        console.error('Relationship delete error', err);
        setConnectionError(err instanceof Error ? err.message : 'Failed to delete relationship');
      }
    },
    [refreshSnapshot],
  );

  return (
    <section className="explore">
      <div className="explore__canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          onConnect={handleConnect}
          onPaneClick={onPaneClick}
          onNodesChange={handleNodesChange}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 1.6 }}
          minZoom={0.3}
          maxZoom={2}
          nodesDraggable
          nodesConnectable
          defaultViewport={{ x: -GRAPH_SIZE / 3, y: -GRAPH_SIZE / 3, zoom: 0.8 }}
          style={reactFlowStyle}
        >
          <Background color="rgba(124, 92, 255, 0.2)" gap={32} />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>

        {(loading || error || (!loading && !error && nodes.length === 0)) && (
          <div className="explore__status">
            <p>
              {loading
                ? 'Loading knowledge graph…'
                : error
                ? `Unable to load graph: ${error}`
                : 'No objectives captured yet — start in Capture to seed the graph.'}
            </p>
          </div>
        )}

        {selectedObjective && !loading && !error && (
          <div className="explore__popover" role="dialog" aria-live="polite">
            <h4>{selectedObjective.status.replace('_', ' ')}</h4>
            <p>{selectedObjective.text}</p>
            {selectedObjective.tags && selectedObjective.tags.length > 0 && (
              <div className="explore__popover-tags">
                {selectedObjective.tags.map((tag) => (
                  <span key={tag} className="explore__popover-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="explore__relations">
              <h4>Connections</h4>
              {popoverRelations.length === 0 && <p>No direct links recorded yet.</p>}
              {popoverRelations.length > 0 && (
                <ul>
                  {popoverRelations.map((relation) => (
                    <li key={relation.id}>
                      <strong>{relation.type.replace('_', ' ')}</strong>
                      <p>{relation.target.text}</p>
                      {relation.rationale && <small>{relation.rationale}</small>}
                      <button
                        type="button"
                        className="explore__relation-remove"
                        onClick={() => handleRelationDelete(relation.id)}
                      >
                        Remove link
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {connectionForm && (
          <div className="explore__builder" role="dialog" aria-live="polite">
            <h4>Create relationship</h4>
            <p>
              Establish a connection from{' '}
              <strong>{nodeMap.get(connectionForm.sourceId)?.text ?? connectionForm.sourceId}</strong> to{' '}
              <strong>{nodeMap.get(connectionForm.targetId)?.text ?? connectionForm.targetId}</strong>.
            </p>
            <label htmlFor="connection-type">Relationship type</label>
            <select
              id="connection-type"
              value={connectionForm.type}
              onChange={(event) =>
                setConnectionForm((prev) =>
                  prev ? { ...prev, type: event.target.value as RelationshipType } : prev,
                )
              }
            >
              {RELATIONSHIP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ')}
                </option>
              ))}
            </select>

            <label htmlFor="connection-rationale">Rationale (optional)</label>
            <textarea
              id="connection-rationale"
              rows={3}
              placeholder="Explain why these nodes connect…"
              value={connectionForm.rationale}
              onChange={(event) =>
                setConnectionForm((prev) => (prev ? { ...prev, rationale: event.target.value } : prev))
              }
            />

            {connectionError && <p className="explore__builder-error">{connectionError}</p>}

            <div className="explore__builder-actions">
              <button type="button" onClick={handleConnectionSave} disabled={connectionSaving}>
                {connectionSaving ? 'Linking…' : 'Create link'}
              </button>
              <button type="button" className="tickets__secondary" onClick={handleConnectionCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {connectionError && !connectionForm && (
          <div className="explore__builder-error explore__builder-error--toast" role="alert">
            {connectionError}
          </div>
        )}
      </div>
    </section>
  );
}
