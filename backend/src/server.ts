import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { objectivesRouter } from './routes/objectives.js';
import { prisma } from './database.js';
import { ollamaClient } from './llm/ollamaClient.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/objectives', objectivesRouter);

app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'connected';
    
    // Check Ollama availability
    const ollamaStatus = await ollamaClient.healthCheck() ? 'available' : 'unavailable';
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: dbStatus,
      llm: ollamaStatus
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'error',
      llm: 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const PORT = config.PORT;

app.listen(PORT, () => {
  console.log('\n🚀 ===== VISIUM BACKEND STARTED =====');
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`🦙 Ollama URL: ${config.OLLAMA_URL}`);
  console.log(`🤖 Model: ${config.OLLAMA_MODEL}`);
  console.log(`💾 Database: ${config.DATABASE_URL.includes('@') ? config.DATABASE_URL.split('@')[1] : 'configured'}`);
  console.log(`🔗 Embeddings: ${config.EMBEDDINGS_ENABLED ? 'enabled' : 'disabled (using keyword matching)'}`);
  console.log('📊 Ready to process requests...\n');
});