import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createKnowledgeGraphEntry,
  createObjectiveRelationshipRecord,
  deleteObjectiveRelationshipRecord,
  getKnowledgeGraphSnapshot,
  getObjectivesByIds,
  getObjectivesForPrompt,
  getObjectivesWithRelations,
  searchObjectives,
  updateObjectiveRelationshipRecord,
  prisma,
  type ObjectiveDTO,
  type ObjectiveDraft,
  type RelationshipDraft,
} from '../database.js';
import {
  ObjectivePriority,
  ObjectiveRelationshipType,
  ObjectiveStatus,
  Prisma,
} from '@prisma/client';
import {
  extractObjectiveGraph,
  generateBrainInsight,
  type AgentGraphExtraction,
  type AgentObjective,
  type AgentRelationship,
} from '../llm/agent.js';

export const objectivesRouter = Router();

const extractAndStoreSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  title: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const getObjectivesSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
  query: z.string().optional(),
});

const getObjectivesBatchSchema = z.object({
  ids: z
    .union([z.string().min(1), z.array(z.string().min(1))])
    .transform((value) => {
      const values = Array.isArray(value) ? value : value.split(',');
      return values.map((id) => id.trim()).filter((id) => id.length > 0);
    })
    .refine((ids) => ids.length > 0, 'Provide at least one objective id'),
});

const brainQuerySchema = z.object({
  question: z.string().min(5, 'Ask a complete question'),
});

const createRelationshipSchema = z.object({
  fromId: z.string().uuid('fromId must be a valid UUID'),
  toId: z.string().uuid('toId must be a valid UUID'),
  type: z.nativeEnum(ObjectiveRelationshipType),
  rationale: z.string().trim().max(1000).optional().nullable(),
  weight: z.number().optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.fromId === value.toId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Relationships must connect two different objectives',
      path: ['toId'],
    });
  }
});

const updateRelationshipSchema = z
  .object({
    toId: z.string().uuid('toId must be a valid UUID').optional(),
    type: z.nativeEnum(ObjectiveRelationshipType).optional(),
    rationale: z.string().trim().max(1000).optional().nullable(),
    weight: z.number().optional().nullable(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field to update',
  });

// POST /api/objectives/extract-and-store
objectivesRouter.post('/extract-and-store', async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log('\n🚀 [EXTRACT-AND-STORE] Starting request...');

  try {
    const { text, title, tags } = extractAndStoreSchema.parse(req.body);
    const manualTags = sanitizeList(tags ?? [], { lowercase: true });
    console.log(`📝 [INPUT] Received text: ${text.length} characters`);
    console.log(`📝 [INPUT] Preview: "${text.substring(0, 140)}${text.length > 140 ? '…' : ''}"`);

    const existingObjectives = await getObjectivesForPrompt(24);
    console.log(`📚 [CONTEXT] Providing ${existingObjectives.length} objectives to the agent for grounding`);

    console.log('🤖 [LLM] Requesting structured graph extraction...');
    const extraction = await extractObjectiveGraph(text, {
      title: title ?? null,
      existingObjectives,
    });

    const drafts = await prepareObjectiveDrafts(extraction, {
      title: title ?? null,
      rawText: text,
    });

    if (manualTags.length > 0) {
      drafts.objectives = drafts.objectives.map((objective) => ({
        ...objective,
        tags: Array.from(new Set([...(objective.tags ?? []), ...manualTags])),
      }));
    }

    if (drafts.objectives.length === 0 && drafts.relationships.length === 0) {
      console.log('⚠️ [RESULT] No new objectives or relationships to store');
      return res.json({
        objectives: [],
        totalInserted: 0,
        duplicatesSkipped: drafts.duplicates,
        relationshipsCreated: 0,
      });
    }

    console.log(`💾 [DATABASE] Persisting ${drafts.objectives.length} objectives and ${drafts.relationships.length} relationships`);
    const persistenceResult = await createKnowledgeGraphEntry({
      rawContent: text,
      title: extraction.title ?? title ?? null,
      objectives: drafts.objectives,
      relationships: drafts.relationships,
    });

    const objectiveIds = persistenceResult.objectives.map((obj) => obj.id);
    const insertedObjectives = await getObjectivesByIds(objectiveIds);

    const payload = insertedObjectives.map(formatObjectiveForResponse);

    const totalDuration = Date.now() - startTime;
    console.log(`\n🎉 [COMPLETE] Stored ${payload.length} objectives in ${totalDuration}ms`);

    return res.json({
      objectives: payload,
      totalInserted: payload.length,
      duplicatesSkipped: drafts.duplicates,
      relationshipsCreated: persistenceResult.relationships.length,
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`\n❌ [ERROR] Request failed after ${totalDuration}ms`);
    console.error('❌ [ERROR] Details:', error);

    if (error instanceof z.ZodError) {
      console.error('❌ [VALIDATION] Invalid input data:', error.errors);
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to extract and store objectives',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/objectives
objectivesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, offset, query } = getObjectivesSchema.parse(req.query);

    const objectives = query && query.length > 0
      ? await searchObjectives(query, limit, offset)
      : await getObjectivesWithRelations(limit, offset);

    return res.json({
      objectives: objectives.map(formatObjectiveForResponse),
      total: objectives.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error getting objectives:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to get objectives',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/objectives/batch?ids=a,b,c
objectivesRouter.get('/batch', async (req: Request, res: Response) => {
  try {
    const parsed = getObjectivesBatchSchema.parse({ ids: req.query.ids ?? '' });
    const objectives = await getObjectivesByIds(parsed.ids);

    return res.json({
      objectives: objectives.map(formatObjectiveForResponse),
      total: objectives.length,
    });
  } catch (error) {
    console.error('Error fetching objective batch:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch objectives',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/objectives/relationships
objectivesRouter.post('/relationships', async (req: Request, res: Response) => {
  try {
    const payload = createRelationshipSchema.parse(req.body);
    const result = await createObjectiveRelationshipRecord(payload);

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Relationship already exists for this pair and type' });
    }

    console.error('Error creating relationship:', error);
    return res.status(500).json({
      error: 'Failed to create relationship',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PATCH /api/objectives/relationships/:id
objectivesRouter.patch('/relationships/:id', async (req: Request, res: Response) => {
  const relationshipId = req.params.id;

  if (!relationshipId) {
    return res.status(400).json({ error: 'Relationship id is required' });
  }

  try {
    const payload = updateRelationshipSchema.parse(req.body);
    if (payload.toId) {
      const existing = await prisma.objectiveRelationship.findUnique({
        where: { id: relationshipId },
        select: { fromId: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Relationship not found' });
      }

      if (existing.fromId === payload.toId) {
        return res.status(400).json({ error: 'Relationships must connect two different objectives' });
      }
    }

    const result = await updateObjectiveRelationshipRecord(relationshipId, payload);
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Relationship already exists for this pair and type' });
      }
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Relationship not found' });
      }
    }

    console.error('Error updating relationship:', error);
    return res.status(500).json({
      error: 'Failed to update relationship',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/objectives/relationships/:id
objectivesRouter.delete('/relationships/:id', async (req: Request, res: Response) => {
  const relationshipId = req.params.id;

  if (!relationshipId) {
    return res.status(400).json({ error: 'Relationship id is required' });
  }

  try {
    const result = await deleteObjectiveRelationshipRecord(relationshipId);
    return res.json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    console.error('Error deleting relationship:', error);
    return res.status(500).json({
      error: 'Failed to delete relationship',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/objectives/graph
objectivesRouter.get('/graph', async (_req: Request, res: Response) => {
  try {
    const snapshot = await getKnowledgeGraphSnapshot();
    return res.json(snapshot);
  } catch (error) {
    console.error('Error fetching knowledge graph snapshot:', error);
    return res.status(500).json({
      error: 'Failed to load knowledge graph',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/objectives/brain
objectivesRouter.post('/brain', async (req: Request, res: Response) => {
  try {
    const { question } = brainQuerySchema.parse(req.body);
    const snapshot = await getKnowledgeGraphSnapshot();
    const answer = await generateBrainResponse(question, snapshot);

    return res.json({
      answer,
      totalObjectives: snapshot.objectives.length,
      totalRelationships: snapshot.relationships.length,
    });
  } catch (error) {
    console.error('Error generating brain response:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: 'Failed to produce answer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

async function prepareObjectiveDrafts(
  extraction: AgentGraphExtraction,
  meta: { title: string | null; rawText: string },
): Promise<{
  objectives: ObjectiveDraft[];
  relationships: RelationshipDraft[];
  duplicates: number;
}> {
  const seenTexts = new Set<string>();
  const normalizedStatements = extraction.objectives.map((objective) => normalize(objective.statement));

  const existingMatches = normalizedStatements.length > 0
    ? await prisma.objective.findMany({
        where: {
          OR: normalizedStatements.map((val) => ({
            text: {
              equals: val.original,
              mode: 'insensitive' as const,
            },
          })),
        },
        select: { text: true },
      })
    : [];

  for (const match of existingMatches) {
    seenTexts.add(normalize(match.text).normalized);
  }

  const objectives: ObjectiveDraft[] = [];
  let duplicates = 0;

  for (const objective of extraction.objectives) {
    const normalized = normalize(objective.statement);
    if (normalized.normalized.length === 0) continue;

    if (seenTexts.has(normalized.normalized)) {
      duplicates += 1;
      continue;
    }

    seenTexts.add(normalized.normalized);
    objectives.push(toObjectiveDraft(objective, meta));
  }

  const validKeys = new Set(objectives.map((objective) => objective.key));
  const relationships = (extraction.relationships ?? [])
    .map((relationship) => toRelationshipDraft(relationship))
    .filter((rel): rel is RelationshipDraft => {
      if (!rel) return false;
      const fromValid = rel.from.startsWith('existing:') || validKeys.has(rel.from);
      const toValid = rel.to.startsWith('existing:') || validKeys.has(rel.to);
      return fromValid && toValid;
    });

  return { objectives, relationships, duplicates };
}

function toObjectiveDraft(objective: AgentObjective, meta: { title: string | null; rawText: string }): ObjectiveDraft {
  return {
    key: objective.key,
    text: objective.statement.trim(),
    context: objective.context?.trim() ?? null,
    category: objective.category ?? null,
    timeframe: objective.timeframe ?? null,
    status: parseStatus(objective.status),
    priority: parsePriority(objective.priority),
    confidence: parseConfidence(objective.confidence),
    owner: objective.owner?.trim() ?? null,
    metrics: sanitizeList(objective.metrics),
    tags: sanitizeList(objective.tags, { lowercase: true }),
    sourceLabel: objective.sourceLabel?.trim() ?? meta.title ?? 'Unlabeled intake',
    sourceExcerpt: objective.sourceExcerpt?.trim() ?? null,
  } satisfies ObjectiveDraft;
}

function toRelationshipDraft(relationship: AgentRelationship): RelationshipDraft | null {
  const type = parseRelationshipType(relationship.type);
  if (!type) return null;

  return {
    from: relationship.from,
    to: relationship.to,
    type,
    rationale: relationship.rationale?.trim() ?? null,
    weight: parseWeight(relationship.weight),
  } satisfies RelationshipDraft;
}

function formatObjectiveForResponse(objective: ObjectiveDTO) {
  return {
    id: objective.id,
    text: objective.text,
    createdAt: objective.createdAt,
    updatedAt: objective.updatedAt,
    context: objective.context,
    category: objective.category,
    timeframe: objective.timeframe,
    status: objective.status,
    priority: objective.priority,
    confidence: objective.confidence,
    owner: objective.owner,
    metrics: objective.metrics,
    tags: objective.tags,
    sourceLabel: objective.sourceLabel,
    sourceExcerpt: objective.sourceExcerpt,
    related: objective.related.map((relation) => ({
      id: relation.target.id,
      text: relation.target.text,
      status: relation.target.status,
      priority: relation.target.priority,
      type: relation.type,
      rationale: relation.rationale,
      weight: relation.weight,
    })),
  };
}

interface NormalizedText {
  original: string;
  normalized: string;
}

function normalize(statement: string): NormalizedText {
  const original = statement.trim();
  const normalized = original.toLowerCase().replace(/\s+/g, ' ');
  return { original, normalized };
}

function parseStatus(value?: string | null): ObjectiveStatus | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized in ObjectiveStatus) {
    return ObjectiveStatus[normalized as keyof typeof ObjectiveStatus];
  }

  switch (normalized) {
    case 'IN PROGRESS':
    case 'IN_PROGRESS':
    case 'ACTIVE':
      return ObjectiveStatus.ACTIVE;
    case 'PLANNED':
    case 'PLANNING':
      return ObjectiveStatus.PLANNED;
    case 'BLOCKED':
    case 'ON HOLD':
    case 'ON_HOLD':
      return ObjectiveStatus.BLOCKED;
    case 'DONE':
    case 'COMPLETE':
    case 'COMPLETED':
      return ObjectiveStatus.COMPLETE;
    case 'IDEA':
    case 'PROPOSED':
    default:
      return ObjectiveStatus.PROPOSED;
  }
}

function parsePriority(value?: string | null): ObjectivePriority | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized in ObjectivePriority) {
    return ObjectivePriority[normalized as keyof typeof ObjectivePriority];
  }

  switch (normalized) {
    case 'P0':
    case 'CRITICAL':
    case 'HIGHEST':
      return ObjectivePriority.HIGH;
    case 'P2':
    case 'LOW':
      return ObjectivePriority.LOW;
    default:
      return ObjectivePriority.MEDIUM;
  }
}

function parseRelationshipType(value?: string | null): ObjectiveRelationshipType | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');

  if (normalized in ObjectiveRelationshipType) {
    return ObjectiveRelationshipType[normalized as keyof typeof ObjectiveRelationshipType];
  }

  switch (normalized) {
    case 'SUPPORTS':
    case 'ALIGNS_WITH':
      return ObjectiveRelationshipType.SUPPORTS;
    case 'UNBLOCKS':
    case 'BLOCKED_BY':
    case 'DEPENDS_ON':
      return ObjectiveRelationshipType.DEPENDS_ON;
    case 'RELATES_TO':
    case 'CONNECTED_TO':
      return ObjectiveRelationshipType.RELATES_TO;
    case 'BLOCKS':
      return ObjectiveRelationshipType.BLOCKS;
    case 'INFORMS':
    case 'INSPIRES':
      return ObjectiveRelationshipType.INFORMS;
    default:
      return null;
  }
}

function parseConfidence(value?: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return clamp(value);
  }

  const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(parsed)) return null;

  return parsed > 1 ? clamp(parsed / 100) : clamp(parsed);
}

function parseWeight(value?: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return clamp(value);
  }

  const parsed = parseFloat(String(value));
  if (Number.isNaN(parsed)) return null;
  return clamp(parsed);
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function sanitizeList(values: unknown, opts: { lowercase?: boolean } = {}): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const normalized = opts.lowercase ? trimmed.toLowerCase() : trimmed;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

async function generateBrainResponse(question: string, snapshot: Awaited<ReturnType<typeof getKnowledgeGraphSnapshot>>): Promise<string> {
  if (snapshot.objectives.length === 0) {
    return 'The knowledge graph is empty. Add strategic objectives to ask contextual questions.';
  }

  const objectivesDigest = snapshot.objectives
    .slice(0, 30)
    .map((objective) => {
      const tags = objective.tags.length > 0 ? ` tags: ${objective.tags.join(', ')}` : '';
      const timeframe = objective.timeframe ? ` timeframe: ${objective.timeframe}` : '';
      return `• ${objective.text} (status: ${objective.status}, priority: ${objective.priority}${timeframe}${tags})`;
    })
    .join('\n');

  const relationshipsDigest = snapshot.relationships
    .slice(0, 60)
    .map((rel) => `${rel.type} ${rel.fromId} -> ${rel.toId}${rel.rationale ? ` (${rel.rationale})` : ''}`)
    .join('\n');

  const prompt = `You are the strategic memory for Visium. Users will ask about the current state of their objectives. Base your answer strictly on the provided objectives and relationships. Provide direct, actionable responses.

Objectives:\n${objectivesDigest}

Connections:\n${relationshipsDigest || 'none recorded yet'}

Question: ${question}

Respond with:
- A focused answer (2-4 sentences)
- 2-3 suggested next actions when applicable
- Call out data gaps if the graph lacks enough information.`;

  return generateBrainInsight(prompt);
}
