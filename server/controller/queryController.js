const config = require('../config/config');
const ragEngine = require('../utils/ragEngine');
const db = require('../utils/db');
const crypto = require('crypto');

exports.query = async (req, res, next) => {
  try {
    const { query, repoId, sessionId, stream = true, TopK = 4, model = config.GROQ_CHAT_MODEL || config.OPENROUTER_CHAT_MODEL || 'openai/gpt-oss-120b' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    if (!repoId || !sessionId) {
      return res.status(400).json({ error: 'repoId and sessionId are required' });
    }

    const session = await db.get(
      'SELECT id FROM chat_sessions WHERE id = ? AND repo_id = ?',
      [sessionId, repoId]
    );
    if (!session) {
      return res.status(400).json({ error: 'The selected repository chat session is invalid. Please select the repository again.' });
    }

    // Fetch chat history for this session
    const chatHistory = await db.all(
      "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
      [sessionId]
    );

    const now = new Date().toISOString();
    const userMessageId = crypto.randomUUID();
    
    // Save user message to database
    await db.run(
      "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
      [userMessageId, sessionId, 'user', query, now]
    );

    if (stream) {
      // Establish Server-Sent Events (SSE) headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      // Keep connection alive
      res.write(': ping\n\n');

      try {
        const result = await ragEngine.queryStream(
          query,
          { topK: TopK, model, repoId, chatHistory },
          (textChunk) => {
            // Send chunk data
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: textChunk })}\n\n`);
          }
        );

        // Save AI response to database
        const aiMessageId = crypto.randomUUID();
        await db.run(
          "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
          [aiMessageId, sessionId, 'assistant', result.answer, new Date().toISOString()]
        );

        // Send completion event with full metadata
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          answer: result.answer, 
          sources: result.sources 
        })}\n\n`);
        res.end();
      } catch (err) {
        // SSE error event with full root-cause details
        const errorPayload = {
          type: 'error',
          error: err.message || 'An unknown error occurred while generating the response.',
          status: typeof err.status === 'number' ? err.status : 500,
          code: err.code || 'UNKNOWN_ERROR',
          details: err.details || undefined
        };

        res.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
        res.end();
      }
    } else {
      // Return standard synchronous JSON response
      const result = await ragEngine.queryStream(
        query,
        { topK: TopK, model, repoId, chatHistory },
        null // No progress callback needed for sync
      );
      
      const aiMessageId = crypto.randomUUID();
      await db.run(
        "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
        [aiMessageId, sessionId, 'assistant', result.answer, new Date().toISOString()]
      );

      return res.status(200).json(result);
    }
  } catch (error) {
    // Delegate to the global error middleware so the root cause is surfaced
    return next(error);
  }
};

