import { config } from '../config.js';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.OLLAMA_URL;
    this.model = config.OLLAMA_MODEL;
  }

  async generate(prompt: string): Promise<string> {
    console.log(`🦙 [OLLAMA] Making request to ${this.baseUrl}/api/generate`);
    console.log(`🦙 [OLLAMA] Using model: ${this.model}`);
    console.log(`🦙 [OLLAMA] Prompt length: ${prompt.length} characters`);
    
    const requestStartTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
        } as OllamaRequest),
      });

      const requestDuration = Date.now() - requestStartTime;
      console.log(`🦙 [OLLAMA] Request completed in ${requestDuration}ms`);

      if (!response.ok) {
        console.error(`🦙 [OLLAMA] API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.error('🦙 [OLLAMA] Error details:', errorText);
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaResponse;
      console.log(`🦙 [OLLAMA] Response received, length: ${data.response.length} characters`);
      console.log('🦙 [OLLAMA] Model used:', data.model);
      console.log('🦙 [OLLAMA] Created at:', data.created_at);
      
      return data.response.trim();
    } catch (error) {
      const requestDuration = Date.now() - requestStartTime;
      console.error(`❌ [OLLAMA] Error after ${requestDuration}ms:`, error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('❌ [OLLAMA] Network error - is Ollama running on', this.baseUrl);
      }
      
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const ollamaClient = new OllamaClient();