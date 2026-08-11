const config = require("../config/config");
const vectorDb = require("./vectorDb");
const { AppError } = require("../middleware/errorMiddleware");

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_PAYLOAD_TOO_LARGE = 413;

class RagEngine {
  constructor() {}

  // Common OpenAI-compatible response parser
  parseChatResponse(data, provider, model) {
    let text = "";

    if (data?.choices?.[0]?.message?.content) {
      text = data.choices[0].message.content;
    } else if (typeof data === "string") {
      text = data;
    }

    if (!text || !text.trim()) {
      throw new AppError(
        `${provider} returned an empty response. Check that model "${model}" is valid.`,
        {
          status: 502,
          code: `${provider.toUpperCase()}_EMPTY_RESPONSE`,
          details: {
            provider,
            model,
          },
        },
      );
    }

    return text;
  }

  // Groq
  hasGroq() {
    return Boolean(config.GROQ_API_KEY);
  }

  async callGroq(systemInstruction, userPrompt, model, onChunk) {
    if (!config.GROQ_API_KEY) {
      throw new AppError(
        "GROQ_API_KEY is not configured. Add it to your .env file.",
        {
          status: 500,
          code: "GROQ_NOT_CONFIGURED",
        },
      );
    }

    const groqUrl = "https://api.groq.com/openai/v1/chat/completions";

    const selectedModel =
      model || config.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";

    const body = {
      model: selectedModel,
      messages: [
        {
          role: "system",
          content: systemInstruction,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.2,
      stream: false,
    };

    let response;

    try {
      response = await fetch(groqUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new AppError(
        "Groq connection failed. Please check your internet connectivity.",
        {
          status: 502,
          code: "GROQ_CONNECTION_FAILED",
          cause: err,
          details: {
            provider: "groq",
            model: selectedModel,
          },
        },
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      let parsed = null;

      try {
        parsed = JSON.parse(errorText);
      } catch {
        parsed = null;
      }

      let code = "GROQ_REQUEST_FAILED";

      switch (response.status) {
        case HTTP_BAD_REQUEST:
          code = "GROQ_BAD_REQUEST";
          break;

        case HTTP_UNAUTHORIZED:
          code = "GROQ_INVALID_API_KEY";
          break;

        case HTTP_TOO_MANY_REQUESTS:
          code = "GROQ_RATE_LIMITED";
          break;

        case HTTP_PAYLOAD_TOO_LARGE:
          code = "GROQ_CONTEXT_TOO_LARGE";
          break;
      }

      throw new AppError(
        `Groq request failed with status ${response.status}. ` +
          `Model: ${selectedModel}. ` +
          (errorText ? `Response: ${errorText}` : ""),
        {
          status: response.status,
          code,
          details: {
            provider: "groq",
            model: selectedModel,
            httpStatus: response.status,
            response: parsed || errorText || undefined,
          },
        },
      );
    }

    const data = await response.json();

    const text = this.parseChatResponse(data, "groq", selectedModel);

    if (onChunk) {
      onChunk(text);
    }

    return text;
  }

  // OpenRouter
  hasOpenRouter() {
    return Boolean(config.OPENROUTER_API_KEY);
  }

  async callOpenRouter(systemInstruction, userPrompt, model, onChunk) {
    if (!config.OPENROUTER_API_KEY) {
      throw new AppError(
        "OPENROUTER_API_KEY is not configured. Add it to your .env file.",
        {
          status: 500,
          code: "OPENROUTER_NOT_CONFIGURED",
        },
      );
    }

    const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

    const selectedModel =
      model || config.OPENROUTER_CHAT_MODEL || "openrouter/free";

    const body = {
      model: selectedModel,
      messages: [
        {
          role: "system",
          content: systemInstruction,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.2,
      stream: false,
    };

    let response;

    try {
      response = await fetch(openRouterUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new AppError(
        "OpenRouter connection failed. Please check your internet connectivity.",
        {
          status: 502,
          code: "OPENROUTER_CONNECTION_FAILED",
          cause: err,
          details: {
            provider: "openrouter",
            model: selectedModel,
          },
        },
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      let parsed = null;

      try {
        parsed = JSON.parse(errorText);
      } catch {
        parsed = null;
      }

      let code = "OPENROUTER_REQUEST_FAILED";

      switch (response.status) {
        case HTTP_BAD_REQUEST:
          code = "OPENROUTER_BAD_REQUEST";
          break;

        case HTTP_UNAUTHORIZED:
          code = "OPENROUTER_INVALID_API_KEY";
          break;

        case HTTP_PAYMENT_REQUIRED:
          code = "OPENROUTER_INSUFFICIENT_BALANCE";
          break;

        case HTTP_TOO_MANY_REQUESTS:
          code = "OPENROUTER_RATE_LIMITED";
          break;

        case HTTP_PAYLOAD_TOO_LARGE:
          code = "OPENROUTER_CONTEXT_TOO_LARGE";
          break;
      }

      throw new AppError(
        `OpenRouter request failed with status ${response.status}. ` +
          `Model: ${selectedModel}. ` +
          (errorText ? `Response: ${errorText}` : ""),
        {
          status: response.status,
          code,
          details: {
            provider: "openrouter",
            model: selectedModel,
            httpStatus: response.status,
            response: parsed || errorText || undefined,
          },
        },
      );
    }

    const data = await response.json();

    const text = this.parseChatResponse(data, "openrouter", selectedModel);

    if (onChunk) {
      onChunk(text);
    }

    return text;
  }

  // Provider order
  getProviderOrder() {
    const order = [];

    // Primary provider
    if (this.hasGroq()) {
      order.push("groq");
    }

    // Fallback provider
    if (this.hasOpenRouter()) {
      order.push("openrouter");
    }

    return order;
  }

  // RAG Query

  /**
   * Run RAG query and return the response.
   *
   * @param {string} queryText
   * @param {object} options
   * @param {function} onChunk
   * @returns {Promise<{answer: string, sources: Array}>}
   */
  async queryStream(queryText, options = {}, onChunk) {
    const topK = Math.min(options.topK || 4, 8);

    // 1. Search vector database
    let searchResults = [];

    try {
      searchResults = await vectorDb.search(queryText, topK);
    } catch (err) {
      console.error("Error querying vector DB:", err);
    }

    // 2. Build context
    let contextStr = "";
    const sources = [];

    if (searchResults.length > 0) {
      contextStr = searchResults
        .map((res, index) => {
          const chunk = res.chunk;

          sources.push({
            id: chunk.id,
            filePath: chunk.filePath,
            fileName: chunk.fileName,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            similarity: res.similarity,
            content: chunk.content,
            language: chunk.language,
          });

          return `---
Source Block #${index + 1}
File: ${chunk.filePath}
Lines: ${chunk.startLine}-${chunk.endLine}
Language: ${chunk.language}
Similarity Score: ${res.similarity.toFixed(4)}

\`\`\`${chunk.language}
${chunk.content}
\`\`\`
`;
        })
        .join("\n\n");
    }

    // 3. System instruction
    const systemInstruction = `
You are "AI Codebase Assistant", a helpful, professional, and expert AI developer assistant.

Your primary responsibility is to answer questions about the user's repository using the retrieved code context.

GUIDELINES:

1. Ground repository-specific answers in the provided code snippets.

2. When referring to repository code, mention the relevant file path and line range whenever possible.

3. Do NOT invent files, functions, variables, APIs, database tables, routes, or implementation details that are not supported by the retrieved context.

4. If the retrieved context is insufficient to answer a repository-specific question, explicitly say that the available context is insufficient.

5. You may provide general software-development guidance when repository context is insufficient, but clearly distinguish general guidance from facts about the repository.

6. Be precise, concise, and structured.

7. Use Markdown for explanations and code.

8. If multiple source blocks are relevant, combine them into one coherent explanation.

9. Never claim that something exists in the repository unless the provided context supports that claim.
`.trim();

    // 4. User prompt
    let userPrompt = "";

    if (contextStr) {
      userPrompt = `
Below are code snippets retrieved from the user's repository.

================ REPOSITORY CONTEXT ================

${contextStr}

================ END REPOSITORY CONTEXT ================

User Question:
${queryText}

Analyze the retrieved repository context and provide the most accurate answer possible.
`.trim();
    } else {
      userPrompt = `
No relevant repository code was retrieved for this question.

User Question:
${queryText}

Explain that the available repository context is insufficient and provide general software-development guidance only where useful.
`.trim();
    }

    // 5. Get providers

    const providerOrder = this.getProviderOrder();

    if (!providerOrder.length) {
      throw new AppError(
        "No AI chat provider configured. Configure GROQ_API_KEY or OPENROUTER_API_KEY in your .env file.",
        {
          status: 500,
          code: "NO_LLM_PROVIDER",
          details: {
            attemptedProviders: [],
          },
        },
      );
    }

    // 6. Try providers in order

    let fullText = "";
    let providerError = null;

    for (const provider of providerOrder) {
      try {
        console.log(`Trying AI provider: ${provider}`);

        if (provider === "groq") {
          fullText = await this.callGroq(
            systemInstruction,
            userPrompt,
            options.provider === "groq"
              ? options.model
              : config.GROQ_CHAT_MODEL,
            onChunk,
          );
        }

        if (provider === "openrouter") {
          fullText = await this.callOpenRouter(
            systemInstruction,
            userPrompt,
            options.provider === "openrouter"
              ? options.model
              : config.OPENROUTER_CHAT_MODEL,
            onChunk,
          );
        }

        if (fullText) {
          console.log(`AI provider succeeded: ${provider}`);
          break;
        }
      } catch (providerErr) {
        providerError = providerErr;

        console.warn(
          `Provider ${provider} failed:`,
          providerErr.message || providerErr,
        );

        // Continue to the next configured provider.
      }
    }

    // 7. All providers failed

    if (!fullText && providerError) {
      throw new AppError("All configured AI chat providers failed.", {
        status: 502,
        code: "ALL_LLM_PROVIDERS_FAILED",
        details: {
          attemptedProviders: providerOrder,
          lastProviderError: {
            provider: providerError.details?.provider,
            code: providerError.code,
            message: providerError.message,
            status: providerError.status,
          },
        },
        cause: providerError,
      });
    }

    return {
      answer: fullText,
      sources,
    };
  }
}

const ragEngineInstance = new RagEngine();

module.exports = ragEngineInstance;
