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
    // Delegate to the global error middleware so the root cause is surfaced
    return next(error);
  }
};

exports.chat = exports.ask;

