import { config } from '../config.js';

interface ObjectiveWithScore {
  id: string;
  text: string;
  score: number;
}

interface RelatedObjective {
  id: string;
  text: string;
}

export async function findRelatedObjectives(
  newObjectiveText: string,
  existingObjectives: Array<{ id: string; text: string }>
): Promise<RelatedObjective[]> {
  console.log(`🔗 [RELATED] Finding related objectives for: "${newObjectiveText}"`);
  console.log(`🔗 [RELATED] Searching among ${existingObjectives.length} existing objectives`);
  
  if (existingObjectives.length === 0) {
    console.log('🔗 [RELATED] No existing objectives to compare against');
    return [];
  }

  if (config.EMBEDDINGS_ENABLED) {
    console.log('🔗 [RELATED] Using embedding-based similarity');
    return findRelatedByEmbeddings(newObjectiveText, existingObjectives);
  } else {
    console.log('🔗 [RELATED] Using keyword-based similarity');
    return findRelatedByKeywords(newObjectiveText, existingObjectives);
  }
}

async function findRelatedByEmbeddings(
  newObjectiveText: string,
  existingObjectives: Array<{ id: string; text: string }>
): Promise<RelatedObjective[]> {
  // TODO: Implement embedding-based similarity when EMBEDDINGS_ENABLED=true
  // For now, fall back to keyword matching
  console.log('Embeddings not yet implemented, falling back to keyword matching');
  return findRelatedByKeywords(newObjectiveText, existingObjectives);
}

function findRelatedByKeywords(
  newObjectiveText: string,
  existingObjectives: Array<{ id: string; text: string }>
): RelatedObjective[] {
  const newWords = extractWords(newObjectiveText);
  console.log(`🔗 [KEYWORDS] Extracted ${newWords.size} unique words from new objective:`, [...newWords]);
  
  const scored: ObjectiveWithScore[] = existingObjectives.map(obj => {
    const existingWords = extractWords(obj.text);
    const score = calculateKeywordOverlap(newWords, existingWords);
    
    return {
      id: obj.id,
      text: obj.text,
      score,
    };
  });

  console.log('🔗 [KEYWORDS] Similarity scores:');
  scored.forEach(obj => {
    if (obj.score > 0) {
      console.log(`  - "${obj.text}" → ${obj.score.toFixed(3)}`);
    }
  });

  // Sort by score descending and take top 5
  const related = scored
    .sort((a, b) => b.score - a.score)
    .filter(obj => obj.score > 0) // Only include objectives with some overlap
    .slice(0, 5)
    .map(obj => ({
      id: obj.id,
      text: obj.text,
    }));

  console.log(`🔗 [KEYWORDS] Selected ${related.length} related objectives`);
  return related;
}

function extractWords(text: string): Set<string> {
  // Convert to lowercase, remove punctuation, split on whitespace
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2) // Remove very short words
    .filter(word => !isStopWord(word)); // Remove stop words
    
  return new Set(words);
}

function calculateKeywordOverlap(words1: Set<string>, words2: Set<string>): number {
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  
  // Jaccard similarity
  return intersection.size / union.size;
}

function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
    'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
    'his', 'her', 'its', 'our', 'their'
  ]);
  
  return stopWords.has(word);
}