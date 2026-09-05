const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const glob = require('fast-glob');
const vectorDb = require('../utils/vectorDb');
const codeSplitter = require('../utils/codeSplitter');
const config = require('../config/config');
const db = require('../utils/db');

const execFileAsync = promisify(execFile);

function setStatus(partial) {
  Object.assign(indexingStatus, partial);
}

// In-memory status tracker
let indexingStatus = {
  status: 'idle', // 'idle', 'indexing', 'completed', 'failed'
  progress: {
    processed: 0,
    total: 0
  },
  error: null,
  filesIndexed: 0,
  chunksIndexed: 0,
  lastIndexedAt: null
};

// Immediately load existing vector DB state from disk at startup
vectorDb.load().then(() => {
  if (vectorDb.lastIndexed) {
    indexingStatus.status = 'completed';
    indexingStatus.filesIndexed = vectorDb.files.length;
    indexingStatus.chunksIndexed = vectorDb.chunks.length;
    indexingStatus.lastIndexedAt = vectorDb.lastIndexed;
  }
}).catch(err => {
  console.error('Error loading initial vector database:', err);
});

function computeHash(content) {
  return crypto.createHash('md5').update(content, 'utf8').digest('hex');
}

function parseGitHubRepoUrl(input) {
  if (!input) return null;

  const trimmed = input.trim();
  const normalized = trimmed.replace(/\\/g, '/');
  const match = normalized.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/i);

  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2].replace(/\/$/, '')
  };
}

async function resolveIndexTarget(dirPath) {
  if (!dirPath || typeof dirPath !== 'string' || dirPath.trim() === '') {
    return { targetDir: config.DEFAULT_INDEX_DIR, sourceType: 'local' };
  }

  const repoInfo = parseGitHubRepoUrl(dirPath);
  if (!repoInfo) {
    return { targetDir: path.resolve(dirPath), sourceType: 'local' };
  }

  const cacheDir = path.join(os.tmpdir(), 'ai-codebase-indexer', `${repoInfo.owner}-${repoInfo.repo}`);
  const repoUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`;

  await fs.mkdir(cacheDir, { recursive: true });

  if (!fsSync.existsSync(path.join(cacheDir, '.git'))) {
    await execFileAsync('git', ['clone', '--depth', '1', repoUrl, cacheDir], { stdio: 'pipe' });
  } else {
    try {
      await execFileAsync('git', ['-C', cacheDir, 'pull', '--ff-only'], { stdio: 'pipe' });
    } catch (pullError) {
      console.warn(`Git pull failed for ${repoUrl}:`, pullError.message);
    }
  }

  return { targetDir: cacheDir, sourceType: 'github' };
}

exports.parseGitHubRepoUrl = parseGitHubRepoUrl;
exports.resolveIndexTarget = resolveIndexTarget;

exports.indexDirectory = async (req, res, next) => {
  try {
    const { dirPath } = req.body;
    
    const { targetDir, sourceType } = await resolveIndexTarget(dirPath);
    const absoluteTargetDir = path.resolve(targetDir);

    if (indexingStatus.status === 'indexing') {
      return res.status(400).json({ error: 'Indexing is already in progress' });
    }

    const repoId = computeHash(absoluteTargetDir);
    const repoName = sourceType === 'github' ? (parseGitHubRepoUrl(dirPath).repo) : path.basename(absoluteTargetDir);
    const now = new Date().toISOString();

    // Ensure repo exists
    await db.run('INSERT OR IGNORE INTO repositories (id, name, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [repoId, repoName, dirPath || absoluteTargetDir, now, now]);

    // Ensure at least one chat session exists
    let activeSession = await db.get('SELECT id FROM chat_sessions WHERE repo_id = ? ORDER BY created_at DESC LIMIT 1', [repoId]);
    if (!activeSession) {
      const sessionId = crypto.randomUUID();
      await db.run('INSERT INTO chat_sessions (id, repo_id, created_at, updated_at) VALUES (?, ?, ?, ?)', [sessionId, repoId, now, now]);
      activeSession = { id: sessionId };
    }

    // Reset status
    setStatus({
      status: 'indexing',
      repoId,
      sessionId: activeSession.id,
      progress: { processed: 0, total: 0 },
      error: null,
      filesIndexed: 0,
      chunksIndexed: 0,
      lastIndexedAt: null
    });

    // Respond immediately to avoid blocking client connection
    res.status(202).json({
      message: 'Incremental indexing started successfully',
      targetDirectory: absoluteTargetDir,
      sourceType,
      statusUrl: '/api/index/status',
      repoId,
      sessionId: activeSession.id
    });

    // Run background worker
    (async () => {
      try {
        console.log(`Starting incremental codebase indexing for directory: ${absoluteTargetDir}`);
        
        // 1. Scan filesystem for supported files
        const filePattern = '**/*.{js,jsx,mjs,cjs,ts,tsx,py,go,java,c,cpp,h,hpp,cs,html,css,json,md,sh,yaml,yml}';
        const diskFiles = await glob(filePattern, {
          cwd: absoluteTargetDir,
          absolute: true,
          ignore: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/coverage/**',
            '**/package-lock.json',
            '**/yarn.lock',
            '**/pnpm-lock.yaml',
            '**/users.json',
            '**/vector_db.json',
            '**/codebase.db'
          ],
          onlyFiles: true
        });

        console.log(`Scanned ${diskFiles.length} files on disk.`);

        // 2. Fetch existing files from database
        const dbFiles = await db.all("SELECT path, hash FROM files WHERE repo_id = ?", [repoId]);
        const dbFileMap = new Map();
        dbFiles.forEach(f => dbFileMap.set(f.path, f.hash));

        const filesToProcess = []; // array of { absolutePath, relativePath, content, hash }
        const scannedRelativePaths = new Set();

        // 3. Compare hashes to find new or modified files
        for (const file of diskFiles) {
          const relativePath = path.relative(absoluteTargetDir, file).replace(/\\/g, '/');
          scannedRelativePaths.add(relativePath);

          try {
            const content = await fs.readFile(file, 'utf8');
            const fileHash = computeHash(content);
            const existingHash = dbFileMap.get(relativePath);

            if (existingHash !== fileHash) {
              filesToProcess.push({
                absolutePath: file,
                relativePath,
                content,
                hash: fileHash
              });
            }
          } catch (readErr) {
            console.error(`Error reading file ${file}:`, readErr);
          }
        }

        // 4. Identify deleted files (in DB but not on disk)
        const deletedFiles = [];
        for (const dbPath of dbFileMap.keys()) {
          if (!scannedRelativePaths.has(dbPath)) {
            deletedFiles.push(dbPath);
          }
        }

        console.log(`Incremental check complete: ${filesToProcess.length} files to update/insert, ${deletedFiles.length} files to delete.`);

        // 5. Handle deleted files
        if (deletedFiles.length > 0) {
          // SQL.js cascade delete will remove chunks automatically
          for (const delPath of deletedFiles) {
            await db.run("DELETE FROM files WHERE repo_id = ? AND path = ?", [repoId, delPath]);
          }
          console.log(`Removed ${deletedFiles.length} obsolete file records.`);
        }

        // 6. Generate chunks for new/modified files
        const newChunks = [];
        for (const fileToProc of filesToProcess) {
          // Cascade delete existing chunks for modified files before inserting new ones
          await db.run("DELETE FROM files WHERE repo_id = ? AND path = ?", [repoId, fileToProc.relativePath]);

          const fileChunks = codeSplitter.chunkFile(
            fileToProc.relativePath,
            fileToProc.content
          );
          
          if (fileChunks.length > 0) {
            newChunks.push({
              relativePath: fileToProc.relativePath,
              hash: fileToProc.hash,
              chunks: fileChunks
            });
          } else {
            // If the file has no valid chunks, still record the file to prevent re-processing
            const now = new Date().toISOString();
            await db.run("INSERT OR REPLACE INTO files (repo_id, path, hash, last_indexed) VALUES (?, ?, ?, ?)", [
              repoId,
              fileToProc.relativePath,
              fileToProc.hash,
              now
            ]);
          }
        }

        // 7. Calculate total chunks to embed and generate embeddings
        const flatChunksToEmbed = newChunks.flatMap(nc => nc.chunks);
        
        if (flatChunksToEmbed.length > 0) {
          setStatus({ progress: { processed: indexingStatus.progress.processed, total: flatChunksToEmbed.length } });
          console.log(`Embedding ${flatChunksToEmbed.length} new/updated chunks...`);

          // Generate embeddings with graceful error handling
          let embeddings = [];
          let embeddingFailed = false;
          try {
            const textsToEmbed = flatChunksToEmbed.map(c => {
              return 'File: ' + c.filePath + '\nLanguage: ' + c.language + '\nContent:\n' + c.content;
            });
            
            embeddings = await vectorDb._generateEmbeddings(textsToEmbed, (processed, total) => {
              indexingStatus.progress.processed = processed;
              indexingStatus.progress.total = total;
              console.log('Embedding progress: ' + processed + '/' + total + ' chunks embedded...');
            });
          } catch (embedErr) {
            console.error('Embedding generation failed, but files will still be stored:', embedErr.message);
            embeddingFailed = true;
          }

          // Insert files & chunks into SQLite database
          const dbInstance = await db.getDb();
          const now = new Date().toISOString();
          
          let embeddingIndex = 0;
          for (const item of newChunks) {
            // Save file record
            await db.run("INSERT OR REPLACE INTO files (repo_id, path, hash, last_indexed) VALUES (?, ?, ?, ?)", [
              repoId,
              item.relativePath,
              item.hash,
              now
            ]);

            // Save chunk records
            for (const chunk of item.chunks) {
              if (!embeddingFailed && embeddingIndex < embeddings.length) {
                const embedding = embeddings[embeddingIndex];
                embeddingIndex++;

                const embeddingFloat32 = new Float32Array(embedding);
                const embeddingBuffer = Buffer.from(embeddingFloat32.buffer);
                const chunkId = chunk.filePath + '_' + chunk.startLine + '_' + embeddingIndex;

                dbInstance.run(
                  'INSERT INTO chunks (id, repo_id, file_path, file_name, language, start_line, end_line, content, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [chunkId, repoId, chunk.filePath, chunk.fileName, chunk.language, chunk.startLine, chunk.endLine, chunk.content, embeddingBuffer]
                );
              } else {
                // Store chunk without embedding (partial indexing)
                embeddingIndex++;
                const chunkId = chunk.filePath + '_' + chunk.startLine + '_' + embeddingIndex;
                
                const emptyEmbedding = new Float32Array(1);
                const emptyBuffer = Buffer.from(emptyEmbedding.buffer);

                dbInstance.run(
                  'INSERT INTO chunks (id, repo_id, file_path, file_name, language, start_line, end_line, content, embedding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [chunkId, repoId, chunk.filePath, chunk.fileName, chunk.language, chunk.startLine, chunk.endLine, chunk.content, emptyBuffer]
                );
              }
            }
          }
        }

        // 8. Commit database to disk & sync memory cache
        vectorDb.indexedDir = absoluteTargetDir;
        vectorDb.lastIndexed = new Date().toISOString();
        await vectorDb.save();

        // 9. Sync final indexingStatus
        setStatus({
          status: 'completed',
          filesIndexed: vectorDb.files.length,
          chunksIndexed: vectorDb.chunks.length,
          lastIndexedAt: vectorDb.lastIndexed
        });
        
        console.log('Incremental indexing finished successfully. DB state: ' + vectorDb.files.length + ' files, ' + vectorDb.chunks.length + ' chunks.');
      } catch (err) {
        console.error('Background incremental indexing process failed:', err);
        setStatus({ status: 'failed', error: err.message });
      }
    })();

  } catch (error) {
    setStatus({ status: 'failed', error: error.message });
    return res.status(500).json({ error: 'Failed to initiate incremental indexing: ' + error.message });
  }
};

exports.clearIndex = async (req, res, next) => {
  try {
    setStatus({
      status: 'idle',
      progress: { processed: 0, total: 0 },
      error: null,
      filesIndexed: 0,
      chunksIndexed: 0,
      lastIndexedAt: null
    });

    await vectorDb.clear();
    await db.run('DELETE FROM files');
    await db.run('DELETE FROM chunks');
    await db.run('DELETE FROM metadata');

    res.status(200).json({ message: 'Index cleared successfully' });
  } catch (error) {
    setStatus({ status: 'failed', error: error.message });
    return res.status(500).json({ error: 'Failed to clear index: ' + error.message });
  }
};

exports.getStatus = (req, res) => {
  return res.status(200).json(indexingStatus);
};

exports.getFiles = (req, res) => {
  return res.status(200).json({
    indexedDir: vectorDb.indexedDir,
    lastIndexed: vectorDb.lastIndexed,
    totalFiles: vectorDb.files.length,
    files: vectorDb.files
  });
};

const llmService = require('../services/llmService');

exports.ask = async (req, res, next) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const answer = await llmService.chatCompletion([
      { role: 'user', content: prompt.trim() }
    ]);

    return res.status(200).json({ answer });
  } catch (error) {
    return next(error);
  }
};

