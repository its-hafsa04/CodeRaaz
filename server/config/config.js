const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'codebase.db');

module.exports = {
  PORT: process.env.PORT || 5000,

  DATA_DIR,
  DB_PATH,

  // Gemini - Embeddings ONLY
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_EMBEDDING_MODEL:
    process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',

  // Groq - Primary AI Chat Provider
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_CHAT_MODEL:
    process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b',

  // OpenRouter - Fallback AI Chat Provider
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_CHAT_MODEL:
    process.env.OPENROUTER_CHAT_MODEL || 'openrouter/free',

  EMBEDDING_BATCH_SIZE:
    parseInt(process.env.EMBEDDING_BATCH_SIZE || '3', 10),

  EMBEDDING_MAX_RETRIES:
    parseInt(process.env.EMBEDDING_MAX_RETRIES || '5', 10),

  EMBEDDING_RETRY_BASE_DELAY_MS:
    parseInt(
      process.env.EMBEDDING_RETRY_BASE_DELAY_MS || '4000',
      10
    ),

  // AI chat provider priority:
  // Groq -> OpenRouter
  CHAT_PROVIDER: process.env.CHAT_PROVIDER || 'groq',

  EMBEDDING_DISABLED:
    process.env.EMBEDDING_DISABLED === 'true' ||
    process.env.EMBEDDING_DISABLED === '1'
};