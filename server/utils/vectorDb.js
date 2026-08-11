const { GoogleGenAI } = require('@google/genai');
const config = require('../config/config');
const db = require('./db');

class VectorDb {
  constructor() {
    this.ai = null;
    this.embeddingProvider = null;
    this._indexedDir = '';
    this._lastIndexed = '';
    this._files = [];
    this._chunksCount = 0;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRetryDelayMs(error, attempt) {
    const retryMatch = error?.message?.match(/retry in ([\d.]+)s/i);
    if (retryMatch) {
      return Math.max(config.EMBEDDING_RETRY_BASE_DELAY_MS, parseFloat(retryMatch[1]) * 1000);
    }

    return config.EMBEDDING_RETRY_BASE_DELAY_MS * (attempt + 1);
  }

  // Initialize embedding provider
  async init() {
    // Already initialized
    if (this.embeddingProvider === 'gemini' && this.ai) return;
    if (this.embeddingProvider === 'disabled') return;

    // Check if embeddings are explicitly disabled
    if (config.EMBEDDING_DISABLED) {
      this.embeddingProvider = 'disabled';
      console.warn('Embeddings are disabled via EMBEDDING_DISABLED config.');
      return;
    }

    if (config.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ 
        apiKey: config.GEMINI_API_KEY,
        httpOptions: { apiVersion: 'v1' }
      });
      this.embeddingProvider = 'gemini';
      return;
    }

    // No provider available
    this.embeddingProvider = 'disabled';
    console.warn(
      'No embedding provider available. ' +
      'Set GEMINI_API_KEY in .env. ' +
      'To disable this warning, set EMBEDDING_DISABLED=true in .env'
    );
  }

  // Getters for controller compatibility
  get indexedDir() {
    return this._indexedDir;
  }
  set indexedDir(val) {
    this._indexedDir = val;
  }

  get lastIndexed() {
    return this._lastIndexed;
  }
  set lastIndexed(val) {
    this._lastIndexed = val;
  }

  get files() {
    return this._files;
  }

  get chunks() {
    return {
      length: this._chunksCount
    };
  }

  // Load state from SQLite DB
  async load() {
    try {
      // 1. Fetch metadata
      const dirMeta = await db.get("SELECT value FROM metadata WHERE key = 'indexed_dir'");
      const timeMeta = await db.get("SELECT value FROM metadata WHERE key = 'last_indexed'");
      
      this._indexedDir = dirMeta ? dirMeta.value : '';
      this._lastIndexed = timeMeta ? timeMeta.value : '';

      // 2. Fetch files list
      const fileRows = await db.all("SELECT path FROM files");
      this._files = fileRows.map(row => row.path);

      // 3. Fetch chunks count
      const countRow = await db.get("SELECT COUNT(*) as count FROM chunks");
      this._chunksCount = countRow ? countRow.count : 0;

      console.log(`Loaded vector database from SQLite with ${this._chunksCount} chunks across ${this._files.length} files.`);
    } catch (error) {
      console.error('Failed to load vector database state:', error);
      // Start fresh on error
      this._indexedDir = '';
      this._lastIndexed = '';
      this._files = [];
      this._chunksCount = 0;
    }
  }

  // Save/commit state to SQLite DB
  async save() {
    try {
      // Upsert metadata
      await db.run("INSERT OR REPLACE INTO metadata (key, value) VALUES ('indexed_dir', ?)", [this._indexedDir]);
      await db.run("INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_indexed', ?)", [this._lastIndexed]);
      
      // Save SQLite database to disk
      db.save();
      
      // Re-fetch files & chunk counts to sync state
      await this.load();
    } catch (error) {
      console.error('Failed to save vector database:', error);
      throw error;
    }
  }

  // Clear DB
  async clear() {
    await db.run("DELETE FROM chunks");
    await db.run("DELETE FROM files");
    await db.run("DELETE FROM metadata");
    
    this._indexedDir = '';
    this._lastIndexed = '';
    this._files = [];
    this._chunksCount = 0;
    
    db.save();
    console.log('Vector database cleared.');
  }

  async _embedBatch(batch, taskType = 'RETRIEVAL_DOCUMENT') {
    await this.init();

    if (this.embeddingProvider === 'disabled') {
      throw new Error(
        'Embeddings are disabled. No embedding provider is available. ' +
        'Set GEMINI_API_KEY in your .env file.'
      );
    }

    const candidateModels = Array.from(new Set([
      config.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'
    ]));
    let lastError = null;

    for (const modelName of candidateModels) {
      for (let attempt = 0; attempt <= config.EMBEDDING_MAX_RETRIES; attempt += 1) {
        try {
          const response = await this.ai.models.embedContent({
            model: modelName,
            contents: batch,
            config: {
              taskType
            }
          });

          if (response && response.embeddings) {
            return response.embeddings.map(e => e.values);
          }

          throw new Error('Invalid response structure from Gemini API: missing embeddings array');
        } catch (err) {
          const message = err?.message || '';
          const isUnsupportedModelError = err?.status === 404 || message.includes('not found') || message.includes('not supported');
          const isRateLimitError = err?.status === 429 || err?.status === 'RESOURCE_EXHAUSTED' || /quota|rate limit|retry in/i.test(message);

          if (isUnsupportedModelError) {
            lastError = err;
            console.warn(`Gemini embedding model ${modelName} is unsupported in this environment; trying the next fallback model.`);
            break;
          }

          if (!isRateLimitError || attempt >= config.EMBEDDING_MAX_RETRIES) {
            lastError = err;
            break;
          }

          const retryDelayMs = this.getRetryDelayMs(err, attempt);
          console.warn(`Gemini embedding quota reached for ${modelName}; retrying in ${retryDelayMs}ms (attempt ${attempt + 1}/${config.EMBEDDING_MAX_RETRIES + 1})`);
          await this.sleep(retryDelayMs);
        }
      }
    }

    throw lastError || new Error('Failed to generate embeddings with the Gemini embedding model.');
  }

  // Generate embeddings for a list of text strings in batches
  async _generateEmbeddings(texts, onProgress, taskType = 'RETRIEVAL_DOCUMENT') {
    await this.init();
    const batchSize = config.EMBEDDING_BATCH_SIZE || 3;
    const embeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const batchEmbeddings = await this._embedBatch(batch, taskType);
        embeddings.push(...batchEmbeddings);

        if (onProgress) {
          onProgress(Math.min(i + batchSize, texts.length), texts.length);
        }
      } catch (err) {
        console.error(`Error generating embeddings for batch starting at index ${i}:`, err);
        throw err;
      }
    }

    return embeddings;
  }

// Add chunks and generate embeddings (fresh indexing helper)
  async addChunks(rawChunks, indexedDir, onProgress) {
    await this.init();

    // 1. Generate embeddings for all chunks in batches
    const textsToEmbed = rawChunks.map(c => `File: ${c.filePath}\nLanguage: ${c.language}\nContent:\n${c.content}`);
    const embeddings = await this._generateEmbeddings(textsToEmbed, onProgress, 'RETRIEVAL_DOCUMENT');

    // 2. Insert files into files table
    const fileSet = new Set(rawChunks.map(c => c.filePath));
    const now = new Date().toISOString();
    
    const dbInstance = await db.getDb();
    
    for (const filePath of fileSet) {
      // Calculate a placeholder hash since this method is used for fresh/non-incremental runs
      await db.run(
        "INSERT OR REPLACE INTO files (path, hash, last_indexed) VALUES (?, ?, ?)",
        [filePath, 'fresh_placeholder_hash', now]
      );
    }

    // 3. Insert chunks into chunks table
    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i];
      const embedding = embeddings[i];
      
      // Convert Float32Array to Node Buffer (WASM blob storage)
      const embeddingFloat32 = new Float32Array(embedding);
      const embeddingBuffer = Buffer.from(embeddingFloat32.buffer);

      const chunkId = `${chunk.filePath}_${chunk.startLine}_${i}`;

      dbInstance.run(
        `INSERT INTO chunks (id, file_path, file_name, language, start_line, end_line, content, embedding)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [chunkId, chunk.filePath, chunk.fileName, chunk.language, chunk.startLine, chunk.endLine, chunk.content, embeddingBuffer]
      );
    }

    // 4. Update metadata and save
    this._indexedDir = indexedDir;
    this._lastIndexed = now;
    await this.save();
  }

  // Calculate Cosine Similarity
  _cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Search top K closest chunks
  async search(queryText, TopK = 4) {
    await this.init();
    
    const countRow = await db.get("SELECT COUNT(*) as count FROM chunks");

    // Handle disabled embeddings gracefully
    if (this.embeddingProvider === 'disabled') {
      if (countRow && countRow.count > 0) {
        console.warn('Embeddings disabled - cannot perform semantic search. Returning empty results.');
      }
      return [];
    }

    if (!countRow || countRow.count === 0) {
      return [];
    }

    // 1. Embed the search query
    let queryEmbedding;
    try {
      [queryEmbedding] = await this._generateEmbeddings([queryText], null, 'RETRIEVAL_QUERY');
    } catch (err) {
      console.error('Failed to embed search query:', err.message);
      return [];
    }

    if (!queryEmbedding || queryEmbedding.length === 0) {
      return [];
    }

    // 2. Fetch all chunks from SQLite
    const chunks = await db.all("SELECT id, file_path, file_name, language, start_line, end_line, content, embedding FROM chunks WHERE embedding IS NOT NULL");

    // 3. Compute similarity for each chunk in memory
    const results = chunks.map(chunk => {
      const uint8 = chunk.embedding; // In sql.js, BLOB is retrieved as Uint8Array
      
      // Handle potential memory alignment issues with WebAssembly buffer offsets
      let floatArray;
      if (uint8.byteOffset % 4 === 0) {
        floatArray = new Float32Array(uint8.buffer, uint8.byteOffset, uint8.byteLength / 4);
      } else {
        // Copy to a new aligned buffer
        const alignedBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
        floatArray = new Float32Array(alignedBuffer);
      }

      const similarity = this._cosineSimilarity(queryEmbedding, floatArray);
      
      return {
        chunk: {
          id: chunk.id,
          filePath: chunk.file_path, // remap to snakeCase for schema to camelCase matching indexController
          fileName: chunk.file_name,
          language: chunk.language,
          startLine: chunk.start_line,
          endLine: chunk.end_line,
          content: chunk.content
        },
        similarity
      };
    });

    // Sort by similarity score descending
    results.sort((a, b) => b.similarity - a.similarity);

    // Return the top K results
    return results.slice(0, TopK);
  }
}

// Export singleton instance
const vectorDbInstance = new VectorDb();
module.exports = vectorDbInstance;
