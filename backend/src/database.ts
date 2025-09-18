import {
  PrismaClient,
  ObjectivePriority,
  ObjectiveStatus,
  ObjectiveRelationshipType,
  type Objective,
  type ObjectiveRelationship,
  type KnowledgeEntry,
} from '@prisma/client';

export const prisma = new PrismaClient();

export interface ObjectiveDraft {
  key: string;
  text: string;
  context?: string | null;
  category?: string | null;
  timeframe?: string | null;
  status?: ObjectiveStatus | null;
  priority?: ObjectivePriority | null;
  confidence?: number | null;
  owner?: string | null;
  metrics?: string[];
  tags?: string[];
  sourceLabel?: string | null;
  sourceExcerpt?: string | null;
}

export interface RelationshipDraft {
  from: string;
  to: string;
  type: ObjectiveRelationshipType;
  rationale?: string | null;
  weight?: number | null;
}

export interface CreateKnowledgeGraphArgs {
  rawContent: string;
  title?: string | null;
  objectives: ObjectiveDraft[];
  relationships: RelationshipDraft[];
}

export interface KnowledgeGraphWriteResult {
  entry: KnowledgeEntry;
  objectives: Objective[];
  relationships: ObjectiveRelationship[];
}

export async function createKnowledgeGraphEntry({
  rawContent,
  title,
  objectives,
  relationships,
}: CreateKnowledgeGraphArgs): Promise<KnowledgeGraphWriteResult> {
  return await prisma.$transaction(async (tx) => {
    const entry = await tx.knowledgeEntry.create({
      data: {
        rawContent,
        title: title ?? null,
      },
    });

    const keyToId = new Map<string, string>();
    const createdObjectives: Objective[] = [];

    for (const objective of objectives) {
      const created = await tx.objective.create({
        data: {
          text: objective.text,
          context: objective.context ?? null,
          category: objective.category ?? null,
          timeframe: objective.timeframe ?? null,
          status: objective.status ?? ObjectiveStatus.PROPOSED,
          priority: objective.priority ?? ObjectivePriority.MEDIUM,
          confidence: objective.confidence ?? null,
          owner: objective.owner ?? null,
          metrics: objective.metrics ?? [],
          tags: objective.tags ?? [],
          sourceLabel: objective.sourceLabel ?? null,
          sourceExcerpt: objective.sourceExcerpt ?? null,
          entryId: entry.id,
        },
      });

      keyToId.set(objective.key, created.id);
      createdObjectives.push(created);
    }

    const createdRelationships: ObjectiveRelationship[] = [];

    for (const relationship of relationships) {
      const fromId = resolveReference(relationship.from, keyToId);
      const toId = resolveReference(relationship.to, keyToId);

      if (!fromId || !toId || fromId === toId) {
        continue;
      }

      const rel = await tx.objectiveRelationship.upsert({
        where: {
          fromId_toId_type: {
            fromId,
            toId,
            type: relationship.type,
          },
        },
        update: {
          rationale: relationship.rationale ?? undefined,
          weight: relationship.weight ?? undefined,
        },
        create: {
          fromId,
          toId,
          type: relationship.type,
          rationale: relationship.rationale ?? null,
          weight: relationship.weight ?? null,
        },
      });

      createdRelationships.push(rel);
    }

    return {
      entry,
      objectives: createdObjectives,
      relationships: createdRelationships,
    } satisfies KnowledgeGraphWriteResult;
  });
}

function resolveReference(ref: string, keyToId: Map<string, string>): string | null {
  if (!ref) return null;
  if (ref.startsWith('existing:')) return ref.substring('existing:'.length);
  return keyToId.get(ref) ?? null;
}

export interface ObjectiveRelationDTO {
  id: string;
  type: ObjectiveRelationshipType;
  rationale: string | null;
  weight: number | null;
  target: {
    id: string;
    text: string;
    status: ObjectiveStatus;
    priority: ObjectivePriority;
  };
}

export interface ObjectiveDTO {
  id: string;
  text: string;
  context: string | null;
  category: string | null;
  timeframe: string | null;
  status: ObjectiveStatus;
  priority: ObjectivePriority;
  confidence: number | null;
  owner: string | null;
  metrics: string[];
  tags: string[];
  sourceLabel: string | null;
  sourceExcerpt: string | null;
  createdAt: Date;
  updatedAt: Date;
  related: ObjectiveRelationDTO[];
}

export async function getObjectivesWithRelations(limit = 50, offset = 0): Promise<ObjectiveDTO[]> {
  const objectives = await prisma.objective.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      outgoingLinks: {
        include: {
          to: {
            select: {
              id: true,
              text: true,
              status: true,
              priority: true,
            },
          },
        },
      },
    },
  });

  return objectives.map(mapObjectiveToDTO);
}

export async function searchObjectives(
  query: string,
  limit = 50,
  offset = 0,
): Promise<ObjectiveDTO[]> {
  const objectives = await prisma.objective.findMany({
    where: {
      OR: [
        {
          text: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          tags: {
            hasSome: [query.toLowerCase()],
          },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      outgoingLinks: {
        include: {
          to: {
            select: {
              id: true,
              text: true,
              status: true,
              priority: true,
            },
          },
        },
      },
    },
  });

  return objectives.map(mapObjectiveToDTO);
}

export interface ObjectiveSummaryForPrompt {
  id: string;
  text: string;
  status: ObjectiveStatus;
  priority: ObjectivePriority;
  category: string | null;
  timeframe: string | null;
  tags: string[];
  updatedAt: Date;
}

export async function getObjectivesForPrompt(limit = 20): Promise<ObjectiveSummaryForPrompt[]> {
  const objectives = await prisma.objective.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      text: true,
      status: true,
      priority: true,
      category: true,
      timeframe: true,
      tags: true,
      updatedAt: true,
    },
  });

  return objectives;
}

export interface KnowledgeGraphSnapshot {
  objectives: ObjectiveDTO[];
  relationships: Array<{
    id: string;
    fromId: string;
    toId: string;
    type: ObjectiveRelationshipType;
    rationale: string | null;
    weight: number | null;
  }>;
}

export async function getKnowledgeGraphSnapshot(): Promise<KnowledgeGraphSnapshot> {
  const objectives = await prisma.objective.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      outgoingLinks: {
        include: {
          to: {
            select: {
              id: true,
              text: true,
              status: true,
              priority: true,
            },
          },
        },
      },
    },
  });

  const relationships = await prisma.objectiveRelationship.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fromId: true,
      toId: true,
      type: true,
      rationale: true,
      weight: true,
    },
  });

  return {
    objectives: objectives.map(mapObjectiveToDTO),
    relationships,
  } satisfies KnowledgeGraphSnapshot;
}

function mapObjectiveToDTO(objective: Objective & {
  outgoingLinks: Array<
    ObjectiveRelationship & {
      to: {
        id: string;
        text: string;
        status: ObjectiveStatus;
        priority: ObjectivePriority;
      };
    }
  >;
}): ObjectiveDTO {
  return {
    id: objective.id,
    text: objective.text,
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
    createdAt: objective.createdAt,
    updatedAt: objective.updatedAt,
    related: objective.outgoingLinks.map((link) => ({
      id: link.id,
      type: link.type,
      rationale: link.rationale,
      weight: link.weight,
      target: {
        id: link.to.id,
        text: link.to.text,
        status: link.to.status,
        priority: link.to.priority,
      },
    })),
  };
}

export async function getObjectivesByIds(ids: string[]): Promise<ObjectiveDTO[]> {
  if (ids.length === 0) return [];

  const objectives = await prisma.objective.findMany({
    where: { id: { in: ids } },
    include: {
      outgoingLinks: {
        include: {
          to: {
            select: {
              id: true,
              text: true,
              status: true,
              priority: true,
            },
          },
        },
      },
    },
  });

  return objectives.map(mapObjectiveToDTO);
}
