const fs = require('fs').promises;
const path = require('path');
const glob = require('fast-glob');

const EXTENSION_MAP = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.html': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.sh': 'shell',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.txt': 'text'
};

function getLanguageByExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] || 'text';
}

/**
 * Splits code file contents into chunks by block boundaries (classes, functions, etc.)
 * falls back to line boundaries if block is too large.
 * @param {string} filePath Relative path of the file
 * @param {string} content Content of the file
 * @param {number} maxChunkSize Target character size for a chunk
 * @param {number} overlapSize Target character size for overlap
 */
function chunkFile(filePath, content, maxChunkSize = 800, overlapSize = 150) {
  const lines = content.split(/\r?\n/);
  const language = getLanguageByExtension(filePath);
  const fileName = path.basename(filePath);

  // Define language-specific regexes to find logical declaration boundaries at start of line
  let splitRegex = null;
  if (language === 'python') {
    splitRegex = /^(def|class)\b/;
  } else if (language === 'javascript' || language === 'typescript') {
    splitRegex = /^(class|function|async\s+function|export\s+(class|function|async\s+function|interface|enum|const|let|var)|interface|enum)\b/;
  } else if (language === 'go') {
    splitRegex = /^(func|type\s+\w+\s+(struct|interface))\b/;
  } else if (language === 'java' || language === 'csharp') {
    splitRegex = /^(public\s+|private\s+|protected\s+)?(class|interface|enum|record)\b/;
  } else if (language === 'markdown') {
    splitRegex = /^#+\s+/;
  }

  // 1. Group lines into semantic blocks
  const blocks = [];
  let currentBlockLines = [];
  let currentBlockStartLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we hit a boundary line
    if (splitRegex && splitRegex.test(line) && currentBlockLines.length > 0) {
      blocks.push({
        startLine: currentBlockStartLine,
        endLine: i,
        lines: currentBlockLines
      });
      currentBlockLines = [];
      currentBlockStartLine = i + 1;
    }
    
    currentBlockLines.push(line);
  }
  
  if (currentBlockLines.length > 0) {
    blocks.push({
      startLine: currentBlockStartLine,
      endLine: lines.length,
      lines: currentBlockLines
    });
  }

  // 2. Group blocks into chunks
  const chunks = [];
  let currentChunkBlocks = [];
  let currentChunkLength = 0;
  let chunkIndex = 0;

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    const blockLength = block.lines.reduce((acc, l) => acc + l.length + 1, 0);

    // Case A: Block is too big on its own -> Chunk line-by-line
    if (blockLength > maxChunkSize) {
      // Flush current chunk first
      if (currentChunkBlocks.length > 0) {
        const mergedLines = currentChunkBlocks.flatMap(bk => bk.lines);
        chunks.push({
          filePath,
          fileName,
          language,
          startLine: currentChunkBlocks[0].startLine,
          endLine: currentChunkBlocks[currentChunkBlocks.length - 1].endLine,
          content: mergedLines.join('\n'),
          chunkIndex
        });
        chunkIndex++;
        currentChunkBlocks = [];
        currentChunkLength = 0;
      }

      // Chunk this large block line-by-line
      let tempLines = [];
      let tempLength = 0;
      let blockLineOffset = 0;

      for (let l = 0; l < block.lines.length; l++) {
        const line = block.lines[l];
        tempLines.push(line);
        tempLength += line.length + 1;

        if (tempLength >= maxChunkSize || l === block.lines.length - 1) {
          chunks.push({
            filePath,
            fileName,
            language,
            startLine: block.startLine + blockLineOffset,
            endLine: block.startLine + l,
            content: tempLines.join('\n'),
            chunkIndex
          });
          chunkIndex++;

          // Extract overlap lines
          let overlapLines = [];
          let overlapLength = 0;
          for (let j = tempLines.length - 1; j >= 0; j--) {
            const oLine = tempLines[j];
            if (overlapLength + oLine.length > overlapSize && overlapLines.length > 0) {
              break;
            }
            overlapLines.unshift(oLine);
            overlapLength += oLine.length + 1;
          }

          tempLines = overlapLines;
          tempLength = overlapLength;
          blockLineOffset = l + 1 - tempLines.length;
        }
      }
      continue;
    }

    // Case B: Adding block exceeds chunk size -> Flush and start a new one with overlap
    if (currentChunkLength + blockLength > maxChunkSize && currentChunkBlocks.length > 0) {
      const mergedLines = currentChunkBlocks.flatMap(bk => bk.lines);
      chunks.push({
        filePath,
        fileName,
        language,
        startLine: currentChunkBlocks[0].startLine,
        endLine: currentChunkBlocks[currentChunkBlocks.length - 1].endLine,
        content: mergedLines.join('\n'),
        chunkIndex
      });
      chunkIndex++;

      // Create overlap lines from the end of the flushed chunk
      let overlapLines = [];
      let overlapLength = 0;
      for (let j = mergedLines.length - 1; j >= 0; j--) {
        const oLine = mergedLines[j];
        if (overlapLength + oLine.length > overlapSize && overlapLines.length > 0) {
          break;
        }
        overlapLines.unshift(oLine);
        overlapLength += oLine.length + 1;
      }

      // Initialize the next chunk with these overlap lines
      const overlapBlock = {
        startLine: Math.max(currentChunkBlocks[0].startLine, currentChunkBlocks[currentChunkBlocks.length - 1].endLine - overlapLines.length + 1),
        endLine: currentChunkBlocks[currentChunkBlocks.length - 1].endLine,
        lines: overlapLines
      };

      currentChunkBlocks = [overlapBlock];
      currentChunkLength = overlapLength;
    }

    // Add block to current chunk
    currentChunkBlocks.push(block);
    currentChunkLength += blockLength;
  }

  // Flush remaining blocks
  if (currentChunkBlocks.length > 0) {
    const isOnlyOverlap = currentChunkBlocks.length === 1 && 
                          currentChunkBlocks[0].lines.length > 0 && 
                          chunks.length > 0 && 
                          currentChunkBlocks[0].endLine === chunks[chunks.length - 1].endLine;

    if (!isOnlyOverlap) {
      const mergedLines = currentChunkBlocks.flatMap(bk => bk.lines);
      chunks.push({
        filePath,
        fileName,
        language,
        startLine: currentChunkBlocks[0].startLine,
        endLine: currentChunkBlocks[currentChunkBlocks.length - 1].endLine,
        content: mergedLines.join('\n'),
        chunkIndex
      });
    }
  }

  return chunks;
}

/**
 * Scan a directory for all matching code files, read and chunk them.
 * @param {string} dirPath Directory path to scan
 * @param {object} options Options like maxChunkSize and overlapSize
 * @returns {Promise<Array>} Array of all chunks across all files
 */
async function scanAndChunkDirectory(dirPath, options = {}) {
  const { maxChunkSize = 800, overlapSize = 150 } = options;
  const absoluteDirPath = path.resolve(dirPath);

  // Glob patterns for supported files
  const filePattern = '**/*.{js,jsx,mjs,cjs,ts,tsx,py,go,java,c,cpp,h,hpp,cs,html,css,json,md,sh,yaml,yml}';

  const files = await glob(filePattern, {
    cwd: absoluteDirPath,
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
      '**/codebase.db' // exclude SQLite DB
    ],
    onlyFiles: true
  });

  const allChunks = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const relativePath = path.relative(absoluteDirPath, file);
      const fileChunks = chunkFile(relativePath, content, maxChunkSize, overlapSize);
      allChunks.push(...fileChunks);
    } catch (error) {
      console.error(`Error reading/chunking file ${file}:`, error);
    }
  }

  return allChunks;
}

module.exports = {
  chunkFile,
  scanAndChunkDirectory,
  getLanguageByExtension
};
