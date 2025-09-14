import { ollamaClient } from './ollamaClient.js';

const AGENT_SYSTEM_PROMPT = `You are Visium, an AI strategy assistant. Transform raw notes or discussions into a small set of clear, self-contained **objectives** that are directly useful for strategy and alignment. Work only with the provided input. Do not invent, and do not output vague placeholders like "I have a startup idea."

Return strict JSON:
{ "candidates": [ { "text": string } ] }

Rules:
- Extract only meaningful, actionable objectives (concrete goals, plans, commitments).
- Each objective must be interpretable without external context.
- Keep each objective semantically whole. If multiple sentences express one clear objective, merge them.
- Remove filler, meta comments, or incomplete thoughts.
- 5–25 words each (flexible if needed to preserve meaning).
- Merge ultra-short fragments into the nearest relevant objective; avoid duplicates.
- Produce 3–15 candidates total.`;

interface ExtractedObjectives {
  candidates: Array<{ text: string }>;
}

export async function extractObjectives(raw: string): Promise<string[]> {
  console.log('🤖 [AGENT] Building prompt for LLM...');
  
  const userPrompt = `Extract objectives from the following input:

<<<INPUT
${raw}
>>>

Return JSON exactly as specified. No preamble, no commentary.`;

  const fullPrompt = `${AGENT_SYSTEM_PROMPT}\n\n${userPrompt}`;
  console.log('🤖 [AGENT] Prompt prepared, calling Ollama...');
  console.log('🤖 [AGENT] Using model:', process.env.OLLAMA_MODEL || 'default');

  try {
    const response = await ollamaClient.generate(fullPrompt);
    console.log('🤖 [AGENT] Received response from Ollama');
    console.log('🤖 [AGENT] Raw response:', response.substring(0, 200) + (response.length > 200 ? '...' : ''));
    
    // Try to extract JSON from the response, handling common formatting issues
    let jsonString = response.trim();
    console.log('🤖 [AGENT] Cleaning response for JSON parsing...');
    
    // Remove markdown code blocks if present
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      console.log('🤖 [AGENT] Removed json code block markers');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
      console.log('🤖 [AGENT] Removed generic code block markers');
    }
    
    console.log('🤖 [AGENT] Attempting to parse JSON...');
    console.log('🤖 [AGENT] JSON string:', jsonString.substring(0, 300) + (jsonString.length > 300 ? '...' : ''));
    
    // Parse the JSON
    const parsed = JSON.parse(jsonString) as ExtractedObjectives;
    console.log('🤖 [AGENT] JSON parsed successfully');
    
    if (!parsed.candidates || !Array.isArray(parsed.candidates)) {
      console.error('🤖 [AGENT] Invalid response format: missing or invalid candidates array');
      console.error('🤖 [AGENT] Parsed object:', parsed);
      throw new Error('Invalid response format: missing or invalid candidates array');
    }
    
    console.log(`🤖 [AGENT] Found ${parsed.candidates.length} candidate objectives`);
    
    const objectives = parsed.candidates
      .map(candidate => candidate.text?.trim())
      .filter(text => text && text.length > 0)
      .slice(0, 15); // Ensure max 15 objectives
    
    console.log(`🤖 [AGENT] Filtered to ${objectives.length} valid objectives`);
    console.log('🤖 [AGENT] Final objectives:', objectives);
    
    return objectives;
      
  } catch (error) {
    console.error('❌ [AGENT] Error extracting objectives:', error);
    console.error('❌ [AGENT] Raw response that caused error:', response);
    console.error('❌ [AGENT] JSON string that failed parsing:', jsonString);
    throw new Error(`Failed to extract objectives: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}