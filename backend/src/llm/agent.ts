import type { ObjectiveSummaryForPrompt } from '../database.js';
import { ollamaClient } from './ollamaClient.js';

const GRAPH_SYSTEM_PROMPT = `You are Visium, an elite strategy intelligence agent. Turn raw notes into a coherent, connected strategic knowledge graph. Only capture well-formed objectives that describe real initiatives, measurable outcomes, or critical dependencies. Reject fluffy ideas like "I have a startup idea" or generic aspirations.

Return strict JSON:
{
  "title": string | null,
  "objectives": [
    {
      "key": string,                  // Unique reference like OBJ_A
      "statement": string,            // 12-40 words, self-contained objective
      "context": string | null,       // Why this matters / supporting detail
      "category": string | null,      // e.g. Growth, Product, Revenue, Operations
      "timeframe": string | null,     // e.g. Q2 2025, 12 weeks, ASAP
      "status": "PROPOSED"|"PLANNED"|"ACTIVE"|"BLOCKED"|"COMPLETE",
      "priority": "HIGH"|"MEDIUM"|"LOW",
      "confidence": number | null,    // 0-1 probability the initiative is correct
      "owner": string | null,         // Responsible team or person from the notes
      "metrics": string[],            // Leading metrics or success signals
      "tags": string[],               // Keywords for later retrieval
      "sourceLabel": string | null,   // Title/name of the source document if present
      "sourceExcerpt": string | null  // Short verbatim snippet backing the objective
    }
  ],
  "relationships": [
    {
      "from": string,                 // key or existing:<id>
      "to": string,                   // key or existing:<id>
      "type": "SUPPORTS"|"DEPENDS_ON"|"RELATES_TO"|"BLOCKS"|"INFORMS",
      "rationale": string | null,
      "weight": number | null         // 0-1 strength / confidence of the link
    }
  ]
}

Rules:
- Produce between 2 and 8 objectives unless fewer genuinely exist.
- Each objective must survive in isolation; include differentiating context.
- Prefer linking new objectives to existing ones when relevant (use existing:<id>).
- Only create relationships with clear causal links. Avoid noisy or redundant edges.
- Derive metrics/tags from the text; do not fabricate data.
- Use source excerpts sparingly (≤ 220 chars) to justify non-obvious claims.
- Never invent owners or timeframes if the source lacks them.`;

const BRAIN_SYSTEM_PROMPT = `You are Visium's strategy brain. Synthesise the institutional knowledge graph into decisive, executive-ready guidance. Base every statement on the provided context. Identify momentum, gaps, and next bets without speculation.`;

export interface AgentObjective {
  key: string;
  statement: string;
  context?: string | null;
  category?: string | null;
  timeframe?: string | null;
  status?: string | null;
  priority?: string | null;
  confidence?: number | string | null;
  owner?: string | null;
  metrics?: string[];
  tags?: string[];
  sourceLabel?: string | null;
  sourceExcerpt?: string | null;
}

export interface AgentRelationship {
  from: string;
  to: string;
  type: string;
  rationale?: string | null;
  weight?: number | string | null;
}

export interface AgentGraphExtraction {
  mode: 'graph-extraction';
  title: string | null;
  objectives: AgentObjective[];
  relationships: AgentRelationship[];
}

interface ExtractObjectiveOptions {
  title: string | null;
  existingObjectives: ObjectiveSummaryForPrompt[];
}

export async function extractObjectiveGraph(
  raw: string,
  options: ExtractObjectiveOptions,
): Promise<AgentGraphExtraction> {
  console.log('🤖 [AGENT] Building graph extraction prompt...');

  const existingSection = buildExistingObjectivesSection(options.existingObjectives);
  const userPrompt = `Existing objectives for reference and linking (use the provided IDs when appropriate):
${existingSection}

Raw intake:
<<<SOURCE
${raw}
>>>

Respond with JSON exactly matching the declared schema. Do not add commentary.`;

  const fullPrompt = `${GRAPH_SYSTEM_PROMPT}\n\n${userPrompt}`;
  const rawResponse = await callOllama(fullPrompt);

  const parsed = parseAgentResponse(rawResponse);
  const objectives = parsed.objectives ?? [];
  const relationships = parsed.relationships ?? [];

  // Ensure keys exist and are unique
  const usedKeys = new Set<string>();
  for (const objective of objectives) {
    if (!objective.key || usedKeys.has(objective.key)) {
      objective.key = generateKey(usedKeys.size + 1);
    }
    usedKeys.add(objective.key);
  }

  return {
    mode: 'graph-extraction',
    title: parsed.title ?? options.title ?? null,
    objectives,
    relationships,
  } satisfies AgentGraphExtraction;
}

export async function generateBrainInsight(prompt: string): Promise<string> {
  console.log('🧠 [BRAIN] Generating strategic insight...');
  const fullPrompt = `${BRAIN_SYSTEM_PROMPT}\n\nContext:\n${prompt}\n\nAnswer with short paragraphs followed by bullet suggestions when relevant.`;
  const rawResponse = await callOllama(fullPrompt);
  return rawResponse.trim();
}

async function callOllama(prompt: string): Promise<string> {
  console.log('🤖 [AGENT] Prompt prepared, calling Ollama...');
  console.log('🤖 [AGENT] Prompt length:', prompt.length);
  return await ollamaClient.generate(prompt);
}

function buildExistingObjectivesSection(existingObjectives: ObjectiveSummaryForPrompt[]): string {
  if (existingObjectives.length === 0) {
    return '• (none)';
  }

  return existingObjectives
    .map((objective, index) => {
      const tags = objective.tags.length > 0 ? ` | tags: ${objective.tags.join(', ')}` : '';
      const timeframe = objective.timeframe ? ` | timeframe: ${objective.timeframe}` : '';
      const category = objective.category ? ` | category: ${objective.category}` : '';
      return `• existing:${objective.id} → ${objective.text} (status: ${objective.status}, priority: ${objective.priority}${timeframe}${category}${tags}) [updated ${objective.updatedAt.toISOString()}]`;
    })
    .join('\n');
}

interface ParsedAgentResponse {
  title?: string | null;
  objectives?: AgentObjective[];
  relationships?: AgentRelationship[];
}

function parseAgentResponse(response: string): ParsedAgentResponse {
  console.log('🤖 [AGENT] Raw response received. Sample:', response.substring(0, 200));
  let jsonString = response.trim();

  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  // Attempt to isolate JSON object if extra preamble slipped in
  const firstBrace = jsonString.indexOf('{');
  const lastBrace = jsonString.lastIndexOf('}');
  if (firstBrace > 0 && lastBrace > firstBrace) {
    jsonString = jsonString.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Parsed response is not an object');
    }

    return parsed as ParsedAgentResponse;
  } catch (error) {
    console.error('❌ [AGENT] Failed to parse JSON response');
    console.error('❌ [AGENT] JSON input:', jsonString);
    throw new Error(`Failed to parse agent response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function generateKey(index: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter = alphabet[(index - 1) % alphabet.length];
  const cycle = Math.floor((index - 1) / alphabet.length);
  return cycle === 0 ? `OBJ_${letter}` : `OBJ_${cycle + 1}${letter}`;
}
