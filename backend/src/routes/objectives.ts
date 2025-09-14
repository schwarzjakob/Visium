import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { extractObjectives } from '../llm/agent.js';
import { findRelatedObjectives } from '../related/related.js';
import { 
  createObjective, 
  getAllObjectives, 
  searchObjectives,
  getObjectivesForRelatedness,
  type ObjectiveWithRelated 
} from '../database.js';

export const objectivesRouter = Router();

// Validation schemas
const extractAndStoreSchema = z.object({
  text: z.string().min(1, 'Text is required'),
});

const getObjectivesSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
  query: z.string().optional(),
});

// POST /api/extract-and-store
objectivesRouter.post('/extract-and-store', async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log('\n🚀 [EXTRACT-AND-STORE] Starting request...');
  
  try {
    const { text } = extractAndStoreSchema.parse(req.body);
    console.log(`📝 [INPUT] Received text: ${text.length} characters`);
    console.log(`📝 [INPUT] Preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

    // Extract objectives using LLM
    console.log('🤖 [LLM] Sending text to agent for objective extraction...');
    const llmStartTime = Date.now();
    const extractedTexts = await extractObjectives(text);
    const llmDuration = Date.now() - llmStartTime;
    
    console.log(`🤖 [LLM] Completed in ${llmDuration}ms`);
    console.log(`🎯 [EXTRACTED] Found ${extractedTexts.length} objectives:`, extractedTexts);

    if (extractedTexts.length === 0) {
      console.log('⚠️  [RESULT] No objectives extracted, returning empty response');
      return res.json({
        objectives: [],
        totalInserted: 0,
      });
    }

    // Get existing objectives for relatedness computation
    console.log('🔍 [DATABASE] Fetching existing objectives for relatedness...');
    const existingObjectives = await getObjectivesForRelatedness();
    console.log(`🔍 [DATABASE] Found ${existingObjectives.length} existing objectives`);

    // Store each objective and compute related ones
    const objectives: ObjectiveWithRelated[] = [];
    let duplicatesSkipped = 0;

    console.log('🔄 [PROCESSING] Starting objective processing...');
    for (let i = 0; i < extractedTexts.length; i++) {
      const objectiveText = extractedTexts[i];
      console.log(`\n📋 [OBJECTIVE ${i + 1}/${extractedTexts.length}] Processing: "${objectiveText}"`);
      
      // Check if similar objective already exists to avoid duplicates
      const isDuplicate = existingObjectives.some(
        existing => 
          existing.text.toLowerCase().trim() === objectiveText.toLowerCase().trim() ||
          calculateSimilarity(existing.text, objectiveText) > 0.85
      );

      if (isDuplicate) {
        console.log(`⚠️  [DUPLICATE] Skipping duplicate objective: "${objectiveText}"`);
        duplicatesSkipped++;
        continue;
      }

      // Create new objective
      console.log('💾 [DATABASE] Saving objective to database...');
      const newObjective = await createObjective({ text: objectiveText });
      console.log(`✅ [DATABASE] Saved with ID: ${newObjective.id}`);

      // Find related objectives
      console.log('🔗 [RELATEDNESS] Computing related objectives...');
      const relatedStartTime = Date.now();
      const related = await findRelatedObjectives(objectiveText, existingObjectives);
      const relatedDuration = Date.now() - relatedStartTime;
      console.log(`🔗 [RELATEDNESS] Found ${related.length} related objectives in ${relatedDuration}ms`);
      if (related.length > 0) {
        console.log('🔗 [RELATEDNESS] Related objectives:', related.map(r => `"${r.text}"`));
      }

      objectives.push({
        id: newObjective.id,
        text: newObjective.text,
        createdAt: newObjective.createdAt,
        related,
      });

      // Add to existing objectives for next iterations
      existingObjectives.push({
        id: newObjective.id,
        text: newObjective.text,
      });
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\n🎉 [COMPLETE] Processing finished in ${totalDuration}ms`);
    console.log(`📊 [SUMMARY] ${objectives.length} objectives stored, ${duplicatesSkipped} duplicates skipped`);

    res.json({
      objectives,
      totalInserted: objectives.length,
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

    console.error('❌ [UNEXPECTED] Unexpected error occurred');
    res.status(500).json({
      error: 'Failed to extract and store objectives',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/objectives
objectivesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, offset, query } = getObjectivesSchema.parse(req.query);

    let objectives;
    
    if (query && query.length > 0) {
      objectives = await searchObjectives(query, limit, offset);
    } else {
      objectives = await getAllObjectives();
      // Apply pagination manually for getAllObjectives
      objectives = objectives.slice(offset, offset + limit);
    }

    res.json({
      objectives: objectives.map(obj => ({
        id: obj.id,
        text: obj.text,
        createdAt: obj.createdAt,
      })),
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

    res.status(500).json({
      error: 'Failed to get objectives',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Simple similarity function for duplicate detection
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}