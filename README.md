# 🤖 CodeRaaz — AI Codebase Assistant

> **Chat with your codebase.** An intelligent RAG (Retrieval-Augmented Generation) system that indexes your source code and lets you ask questions about it in natural language — with full multi-repo and multi-session support.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

---

## ✨ Features

- **🔍 Semantic Code Search** — Index your entire project and query it using natural language. The system understands code structure, file relationships, and programming context.
- **💬 Multi-Session Chat** — Maintain persistent, isolated chat sessions per repository. Each session keeps its own message history stored in SQLite.
- **📦 Multi-Repo Support** — Index and switch between multiple repositories. Each repository gets its own vector index and chat sessions.
- **⚡ Resilient AI Provider Chain** — Uses **Groq** as the primary chat provider with **OpenRouter** as a hot fallback. **Gemini** is used exclusively for high-quality embeddings.
- **📁 Incremental Indexing** — Only re-indexes changed files (hash-based diffing). Supports both local directories and GitHub repos.
- **🛡️ Secure Auth via Clerk** — Powered by **Clerk** for modern, token-based authentication and route protection on both client and server.
- **🎨 Modern React UI** — Dark-themed, mobile-responsive dashboard with a dedicated Landing Page, Dashboard, and Chat view — powered by React 19 + Vite.
- **🩺 Health Endpoint** — Built-in `/health` check endpoint for deployment monitoring.
- **🛠️ Structured Error Handling** — Global error middleware with structured error codes (`GROQ_RATE_LIMITED`, `ALL_LLM_PROVIDERS_FAILED`, etc.) for easy debugging.

---

## 🏗️ Architecture

```
┌──────────────────────────┐      ┌──────────────────────────────────────┐
│   React Client (Vite+TS) │      │   Express Server                     │
│                          │      │                                      │
│  ┌────────────────────┐  │      │  ┌──────────────────────────────┐   │
│  │  LandingPage       │  │◄────►│  │   RAG Engine                 │   │
│  │  Dashboard         │  │ SSE  │  │  ┌──────────────────────┐   │   │
│  │  Chat (sessions)   │  │      │  │  │ Groq (primary chat)  │   │   │
│  │  Layout / Sidebar  │  │      │  │  ├──────────────────────┤   │   │
│  └────────────────────┘  │      │  │  │ OpenRouter (fallback) │   │   │
│                          │      │  │  └──────────────────────┘   │   │
└──────────────────────────┘      │  └──────────────────────────────┘   │
                                  │  ┌──────────────────────────────┐   │
                                  │  │   Vector Database (SQLite)   │   │
                                  │  │  • repositories table        │   │
                                  │  │  • files table (per repo)    │   │
                                  │  │  • chunks table + embeddings │   │
                                  │  │  • chat_sessions table       │   │
                                  │  │  • chat_messages table       │   │
                                  │  │  (Gemini embeddings via WASM)│   │
                                  │  └──────────────────────────────┘   │
                                  │  ┌──────────────────────────────┐   │
                                  │  │   LLM Service Layer          │   │
                                  │  │  (services/llmService.js)    │   │
                                  │  └──────────────────────────────┘   │
                                  │  ┌──────────────────────────────┐   │
                                  │  │   Code Splitter              │   │
                                  │  │   (file → language-aware     │   │
                                  │  │    chunks with line ranges)  │   │
                                  │  └──────────────────────────────┘   │
                                  └──────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite 8, Lucide Icons |
| **Backend** | Node.js ≥18, Express 5 |
| **Database** | SQLite via `sql.js` (in-memory + disk persistence) |
| **LLM – Chat** | Groq (primary) → OpenRouter (fallback) |
| **LLM – Embeddings** | Gemini API (`gemini-embedding-001`) |
| **Auth** | Clerk (`@clerk/express` + `@clerk/clerk-react`) |
| **File Scanning** | `fast-glob` |
| **Linting** | OXLint |

---

## 📋 Prerequisites

- **Node.js** v18+ (with native `fetch` support)
- **npm** v9+
- API keys for: **Groq**, **Gemini**, **Clerk** (OpenRouter is optional but recommended as a fallback)

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/its-hafsa04/CodeRaaz.git
cd AIcodeBase
```

**Server:**

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your API keys (see Configuration section below)
```

**Client:**

```bash
cd ../client
npm install
# Create client/.env.local (see Configuration section below)
```

### 2. Run

Start both in separate terminals:

```bash
# Terminal 1 — Server (port 5000)
cd server
npm run dev

# Terminal 2 — Client (port 5173)
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

### 3. Index & Chat

1. Sign in or create an account (powered by Clerk)
2. On the **Dashboard**, add a repository — paste a local path (e.g., `C:/projects/my-app`) or a GitHub URL
3. Wait for indexing to complete (progress is streamed in real time)
4. Switch to **Chat** and start asking questions:
   - *"How does authentication work?"*
   - *"Show me all API route definitions"*
   - *"Explain the RAG engine architecture"*
   - *"Where are database migrations handled?"*

---

## ⚙️ Configuration

### Server — `server/.env`

Copy `server/.env.example` to `server/.env` and fill in your keys:

```env
# CORS — must match your client's origin
CORS_ORIGIN=http://localhost:5173

# Primary Chat Provider
GROQ_API_KEY=your_groq_key
GROQ_CHAT_MODEL=llama-3.3-70b-versatile

# Fallback Chat Provider
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_CHAT_MODEL=openai/gpt-4o-mini

# Embeddings (required)
GEMINI_API_KEY=your_gemini_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# Auth — Clerk
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Vector dimensions must match the embedding model output
# gemini-embedding-001 outputs 3072 dimensions
VECTOR_DIMENSIONS=3072
```

> **Note:** At least one chat provider (`GROQ_API_KEY` or `OPENROUTER_API_KEY`) and `GEMINI_API_KEY` are required. The server automatically falls back to OpenRouter if Groq fails.

### Client — `client/.env.local`

```env
VITE_SERVER_URL=http://localhost:5000
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

---

## 📡 API Endpoints

All endpoints (except `/health`) require an `Authorization: Bearer <clerk-token>` header.

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server liveness check — returns `{ status: "ok", timestamp }` |

### Indexing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/index` | Start incremental indexing (local path or GitHub URL) |
| `DELETE` | `/api/index` | Clear the entire index for the active repository |
| `GET` | `/api/index/status` | Get current indexing progress and active repo/session IDs |
| `GET` | `/api/index/files` | List all indexed files for the active repository |

### Repositories & Chat Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos` | List all indexed repositories |
| `GET` | `/api/repos/:repoId/chat-sessions` | List chat sessions for a repository |
| `POST` | `/api/repos/:repoId/chat-sessions` | Create a new chat session for a repository |
| `GET` | `/api/chat-sessions/:sessionId/messages` | Fetch all messages for a session |

### Query (RAG)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/query` | Ask a question — returns an SSE stream with answer chunks and sources |

**Query request body:**

```json
{
  "query": "How does authentication work?",
  "repoId": "repo-uuid-here",
  "sessionId": "session-uuid-here",
  "topK": 5
}
```

**Query SSE response:**

```
data: {"type":"chunk","text":"The authentication system uses..."}
data: {"type":"done","answer":"...","sources":[{"filePath":"...","startLine":1,"endLine":42}]}
```

### Chat (Generic)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Generic non-RAG chat completion endpoint |

---

## 📁 Project Structure

```
AIcodeBase/
├── client/                              # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── LandingPage.tsx          # Public landing / marketing page
│   │   │   ├── Dashboard.tsx            # Repo management & indexing UI
│   │   │   ├── Chat.tsx                 # RAG chat interface with session history
│   │   │   └── Layout.tsx               # App shell with sidebar navigation
│   │   ├── utils/
│   │   │   └── api.ts                   # Typed API client (fetch + SSE)
│   │   ├── App.tsx                      # Root app with Clerk auth + view routing
│   │   └── main.tsx                     # Entry point
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── server/                              # Express backend
│   ├── config/
│   │   └── config.js                    # Environment config loader
│   ├── controller/
│   │   ├── chatController.js            # Generic chat completion controller
│   │   ├── chatSessionController.js     # Repo & chat session CRUD
│   │   ├── indexController.js           # Incremental code indexing controller
│   │   └── queryController.js           # RAG query controller (SSE streaming)
│   ├── middleware/
│   │   ├── authMiddleware.js            # Clerk token verification
│   │   └── errorMiddleware.js           # Global 404 + structured error handler
│   ├── routes/
│   │   └── api.js                       # All route definitions
│   ├── services/
│   │   ├── llmService.js                # Groq + OpenRouter chat; Gemini embeddings
│   │   └── providerSelector.js          # Provider availability helpers
│   ├── utils/
│   │   ├── codeSplitter.js              # File → language-aware chunk splitting
│   │   ├── db.js                        # sql.js SQLite layer (in-memory + disk)
│   │   ├── ragEngine.js                 # RAG orchestration (retrieve → augment → generate)
│   │   └── vectorDb.js                  # Cosine-similarity vector search + embedding management
│   ├── data/                            # SQLite DB file (gitignored)
│   ├── app.js                           # Express app setup (CORS, Clerk, routes)
│   ├── index.js                         # Server entry point
│   └── package.json
│
└── README.md
```

---

## 🔧 Development

### Server

```bash
cd server
npm run dev    # nodemon — auto-restarts on file changes
npm start      # production start
```

### Client

```bash
cd client
npm run dev    # Vite HMR at http://localhost:5173
npm run build  # TypeScript check + production build → dist/
npm run lint   # OXLint static analysis
npm run preview # Preview production build locally
```

---

## 🗄️ Database Schema

The SQLite database (`server/data/`) uses the following tables:

| Table | Purpose |
|-------|---------|
| `repositories` | Tracks indexed repositories (id, name, url) |
| `files` | Per-repository file registry with content hashes for incremental indexing |
| `chunks` | Code chunks with raw content + binary embedding blobs (Float32 stored as BLOB) |
| `chat_sessions` | Chat sessions scoped to a repository |
| `chat_messages` | Individual messages (role + content) within a session |
| `metadata` | Key-value store for misc server state |

Schema migrations are handled automatically on startup — old schemas are detected and rebuilt if required columns are missing.

---

## 📄 License

MIT — Free for personal and commercial use.

---

## 🙌 Contributing

Contributions are welcome! Feel free to open issues or submit PRs for:
- New LLM provider integrations
- UI improvements and new views
- Performance optimizations (e.g., pgvector backend)
- Documentation improvements 📃[Doc-link](https://docs.google.com/document/d/1KGyvg9gfjsiUuTR0sy9so8cETjxQT5h5/edit?usp=sharing&ouid=104443357622277225958&rtpof=true&sd=true)
