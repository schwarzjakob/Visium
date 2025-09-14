import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string(),
  OLLAMA_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3'),
  EMBEDDINGS_ENABLED: z.string().transform(val => val === 'true').default('false'),
  PORT: z.string().transform(val => parseInt(val, 10)).default('3001'),
});

const env = envSchema.parse(process.env);

export const config = {
  DATABASE_URL: env.DATABASE_URL,
  OLLAMA_URL: env.OLLAMA_URL,
  OLLAMA_MODEL: env.OLLAMA_MODEL,
  EMBEDDINGS_ENABLED: env.EMBEDDINGS_ENABLED,
  PORT: env.PORT,
};