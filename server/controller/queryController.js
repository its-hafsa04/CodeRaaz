const config = require('../config/config');
const ragEngine = require('../utils/ragEngine');

exports.query = async (req, res, next) => {
  try {
    const { query, stream = true, TopK = 4, model = config.GROQ_CHAT_MODEL || config.OPENROUTER_CHAT_MODEL || 'openai/gpt-oss-120b' } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

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
          { topK: TopK, model },
          (textChunk) => {
            // Send chunk data
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: textChunk })}\n\n`);
          }
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
        { topK: TopK, model },
        null // No progress callback needed for sync
      );
      return res.status(200).json(result);
    }
  } catch (error) {
    // Delegate to the global error middleware so the root cause is surfaced
    return next(error);
  }
};

