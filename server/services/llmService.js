const config = require('../config/config');
const { GoogleGenAI } = require('@google/genai');

// Gemini - Embeddings ONLY

let genAI = null;

function getGenAI() {
  if (!genAI) {
    if (!config.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is missing');
    }

    genAI = new GoogleGenAI({
      apiKey: config.GEMINI_API_KEY,
      httpOptions: { apiVersion: 'v1' }
    });
  }

  return genAI;
}

// Create Embedding

async function createEmbedding(text) {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  const ai = getGenAI();

  const candidateModels = Array.from(
    new Set([
      config.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'
    ])
  );

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.embedContent({
        model: modelName,
        contents: [text],
        config: {
          taskType: 'RETRIEVAL_DOCUMENT'
        }
      });

      if (
        response &&
        response.embeddings &&
        response.embeddings.length > 0 &&
        response.embeddings[0].values
      ) {
        return response.embeddings[0].values;
      }

      throw new Error(
        `Invalid response structure from Gemini embedding model "${modelName}"`
      );
    } catch (err) {
      const message = err?.message || '';

      const isUnsupportedModelError =
        err?.status === 404 ||
        message.includes('not found') ||
        message.includes('not supported');

      if (!isUnsupportedModelError) {
        lastError = err;
        break;
      }

      lastError = err;

      console.warn(
        `Embedding failed for ${modelName}, trying next Gemini embedding model...`
      );
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    'Failed to generate embedding with Gemini.'
  );
}

// Generic HTTP error parser

async function parseProviderError(response, provider, model) {
  const errorText = await response.text().catch(() => '');

  let data = {};

  try {
    data = errorText ? JSON.parse(errorText) : {};
  } catch {
    data = {};
  }

  const providerMessage =
    data?.error?.message ||
    data?.message ||
    errorText ||
    `${provider} chat failed with status ${response.status}`;

  let code = `${provider.toUpperCase()}_REQUEST_FAILED`;

  if (response.status === 400) {
    code = `${provider.toUpperCase()}_BAD_REQUEST`;
  } else if (response.status === 401) {
    code = `${provider.toUpperCase()}_INVALID_API_KEY`;
  } else if (response.status === 402) {
    code = `${provider.toUpperCase()}_INSUFFICIENT_BALANCE`;
  } else if (response.status === 413) {
    code = `${provider.toUpperCase()}_CONTEXT_TOO_LARGE`;
  } else if (response.status === 429) {
    code = `${provider.toUpperCase()}_RATE_LIMITED`;
  } else if (response.status >= 500) {
    code = `${provider.toUpperCase()}_SERVER_ERROR`;
  }

  const err = new Error(
    `${provider} chat failed with status ${response.status}: ${providerMessage}`
  );

  err.status = response.status;
  err.code = code;

  err.details = {
    provider,
    model,
    status: response.status,
    response: data
  };

  return err;
}

// Extract OpenAI-compatible chat response

function extractChatContent(data, provider, model) {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  throw new Error(
    `${provider} returned an empty response for model "${model}".`
  );
}

// Groq - Primary Chat Provider

async function chatWithGroq(messages, options = {}) {
  if (!config.GROQ_API_KEY) {
    const err = new Error(
      'GROQ_API_KEY is missing'
    );

    err.status = 500;
    err.code = 'GROQ_NOT_CONFIGURED';

    throw err;
  }

  const model =
    options.model ||
    config.GROQ_CHAT_MODEL ||
    'openai/gpt-oss-120b';

  const groqUrl =
    'https://api.groq.com/openai/v1/chat/completions';

  const body = {
    model,
    messages,
    temperature:
      typeof options.temperature === 'number'
        ? options.temperature
        : 0.2,
    stream: false
  };

  let response;

  try {
    response = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    const connectionError = new Error(
      'Groq connection failed. Please check your internet connectivity.'
    );

    connectionError.status = 502;
    connectionError.code = 'GROQ_CONNECTION_FAILED';
    connectionError.cause = err;

    connectionError.details = {
      provider: 'groq',
      model
    };

    throw connectionError;
  }

  if (!response.ok) {
    throw await parseProviderError(
      response,
      'groq',
      model
    );
  }

  const data = await response.json();

  return extractChatContent(
    data,
    'Groq',
    model
  );
}

// OpenRouter - Fallback Chat Provider

async function chatWithOpenRouter(messages, options = {}) {
  if (!config.OPENROUTER_API_KEY) {
    const err = new Error(
      'OPENROUTER_API_KEY is missing'
    );

    err.status = 500;
    err.code = 'OPENROUTER_NOT_CONFIGURED';

    throw err;
  }

  const model =
    options.model ||
    config.OPENROUTER_CHAT_MODEL ||
    'openrouter/free';

  const openRouterUrl =
    'https://openrouter.ai/api/v1/chat/completions';

  const body = {
    model,
    messages,
    temperature:
      typeof options.temperature === 'number'
        ? options.temperature
        : 0.2,
    stream: false
  };

  let response;

  try {
    response = await fetch(openRouterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
        'HTTP-Referer': CORS_ORIGIN || 'http://localhost:3000',
        'X-Title': 'AI Codebase Assistant'
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    const connectionError = new Error(
      'OpenRouter connection failed. Please check your internet connectivity.'
    );

    connectionError.status = 502;
    connectionError.code = 'OPENROUTER_CONNECTION_FAILED';
    connectionError.cause = err;

    connectionError.details = {
      provider: 'openrouter',
      model
    };

    throw connectionError;
  }

  if (!response.ok) {
    throw await parseProviderError(
      response,
      'openrouter',
      model
    );
  }

  const data = await response.json();

  return extractChatContent(
    data,
    'OpenRouter',
    model
  );
}

// Provider availability

function hasGroq() {
  return Boolean(config.GROQ_API_KEY);
}

function hasOpenRouter() {
  return Boolean(config.OPENROUTER_API_KEY);
}

// Chat Completion

async function chatCompletion(messages, options = {}) {
  const providers = [];

  if (hasGroq()) {
    providers.push('groq');
  }

  if (hasOpenRouter()) {
    providers.push('openrouter');
  }

  if (providers.length === 0) {
    const err = new Error(
      'No AI chat provider configured. Add GROQ_API_KEY or OPENROUTER_API_KEY to your .env file.'
    );

    err.status = 500;
    err.code = 'NO_LLM_PROVIDER';

    err.details = {
      attemptedProviders: []
    };

    throw err;
  }

  let lastError = null;

  for (const provider of providers) {
    try {
      console.log(
        `[LLM] Trying provider: ${provider}`
      );

      let response;

      if (provider === 'groq') {
        response = await chatWithGroq(
          messages,
          {
            model:
              options.provider === 'groq'
                ? options.model
                : config.GROQ_CHAT_MODEL,
            temperature: options.temperature
          }
        );
      } else if (provider === 'openrouter') {
        response = await chatWithOpenRouter(
          messages,
          {
            model:
              options.provider === 'openrouter'
                ? options.model
                : config.OPENROUTER_CHAT_MODEL,
            temperature: options.temperature
          }
        );
      }

      if (response) {
        console.log(
          `[LLM] Provider succeeded: ${provider}`
        );

        return response;
      }
    } catch (err) {
      lastError = err;

      console.warn(
        `[LLM] Provider ${provider} failed:`,
        err.message || err
      );

      // Continue to next provider.
    }
  }

  const finalError = new Error(
    'All configured AI chat providers failed.'
  );

  finalError.status = 502;
  finalError.code = 'ALL_LLM_PROVIDERS_FAILED';

  finalError.details = {
    attemptedProviders: providers,
    lastError: {
      provider: lastError?.details?.provider,
      status: lastError?.status,
      code: lastError?.code,
      message: lastError?.message
    }
  };

  finalError.cause = lastError;

  throw finalError;
}

// Backward-compatible exports
//
// Existing code can continue calling chatCompletion().
// DeepSeek-specific functions have intentionally been removed.

module.exports = {
  createEmbedding,
  chatWithGroq,
  chatWithOpenRouter,
  chatCompletion
};

