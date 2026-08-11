# 🤖 CodeRaaz - AI Codebase Assistant

> **Chat with your codebase.** An intelligent RAG (Retrieval-Augmented Generation) system that indexes your source code and lets you ask questions about it in natural language.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

---

## ✨ Features

- **🔍 Semantic Code Search** — Index your entire project and query it using natural language. The system understands code structure, file relationships, and programming context.
- **💬 Conversational Q&A** — Ask questions like *"How does authentication work?"* or *"Find all API route definitions"* and get precise, context-aware answers with source references.
- **⚡ Advanced AI Models** — Uses **Gemini** for high-quality embeddings and **Groq + OpenRouter** for lightning-fast AI chat.
- **📁 Incremental Indexing** — Only re-indexes changed files. Supports both local directories and GitHub repos.
- **🛡️ Secure Multi-User Auth** — Powered by **Clerk** for robust, modern authentication and user management.
- **🎨 Modern UI** — Beautiful, mobile-responsive dark-themed React dashboard with animations, real-time streaming responses, and file browsing.

---

## 🏗️ Architecture

```
┌─────────────────────┐      ┌──────────────────────────────┐
│   React Client      │      │   Express Server             │
│   (Vite + TS)       │◄────►│                              │
│                     │ SSE  │  ┌──────────────────────┐    │
│  ┌───────────────┐  │      │  │   RAG Engine          │    │
│  │  Landing Page  │  │      │  │  ┌────────────────┐  │    │
│  │  Dashboard     │  │      │  │  │ Groq (chat)   │  │    │
│  │  Chat UI       │  │      │  │  ├────────────────┤  │    │
│  │  Auth Modal    │  │      │  │  │ OpenRouter (backup) │  │    
│  └───────────────┘  │      │  │  ├────────────────┤  │    │
│                     │      │  │  │ Fallback chain  │  │    │
└─────────────────────┘      │  └────────────────────────┘    │
                             │  ┌──────────────────────┐      │
                             │  │   Vector Database     │      │
                             │  │  (SQLite + sql.js)    │      │
                             │  │  ┌────────────────┐  │      │
                             │  │  │     
                             │  │  │ Gemini Embeds   │  │      │
                             │  │  └────────────────┘  │      │
                             │  └──────────────────────┘      │
                             │  ┌──────────────────────┐      │
                             │  │   Code Splitter       │      │
                             │  │   (file → chunks)     │      │
                             │  └──────────────────────┘      │
                             └──────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite, Lucide Icons |
| **Backend** | Node.js, Express 5 |
| **Database** | SQLite (via sql.js, in-memory + disk persistence) |
| **LLM (Chat)** | Groq and OpenRouter APIs |
| **Embeddings** | Gemini API |
| **Auth** | Clerk |
| **File Scanning** | fast-glob |

---

## 📋 Prerequisites

- **Node.js** v18+ (with `fetch` support)
- **npm** v9+

---

## 🚀 Quick Start 

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd AIcodeBase
```

**Server setup:**

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env` — as explained in `.env.example`

**Client setup:**

```bash
cd ../client
npm install
```

### 2. Run

Start both in separate terminals:

```bash
# Terminal 1: Server (starts on port 5000)
cd server
npm run dev

# Terminal 2: Client (starts on port 5173)
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

### 3. Index & Query

1. Register an account
2. Navigate to Dashboard → **Index a directory** (e.g., `.` for current project)
3. Once indexed, go to **Chat** and ask questions like:
   - *"How does authentication work?"*
   - *"Show me all the API routes"*
   - *"Explain the RAG engine architecture"*

---

## ⚙️ Configuration

Copy `server/.env.example` to `server/.env` and customize:

### Environment Variables

```env
CORS_ORIGIN=localhost:5713
# Chat Providers
GROQ_API_KEY=your_groq_key
GROQ_CHAT_MODEL=groq-chat-model
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_CHAT_MODEL=openrouter-chat-model

# Embeddings
GEMINI_API_KEY=your_gemini_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-model

# Clerk Auth (Client & Server)
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

---

Copy/Paste the following to `client/.env.local` and customize:

### Environment Variables

```env
SERVER_URL=your-server-url
# Clerk Auth (Client & Server)
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

---

## 📡 API Endpoints

All protected endpoints (except `/auth/*`) require a `Bearer <token>` in the `Authorization` header.

### Authentication

Authentication is fully managed by **Clerk**. The backend verifies the Clerk token provided in the `Authorization: Bearer <token>` header for protected routes.

### Indexing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/index` | Start incremental indexing (local path or GitHub URL) |
| `DELETE` | `/api/index` | Clear the entire index |
| `GET` | `/api/index/status` | Get current indexing progress |
| `GET` | `/api/index/files` | List all indexed files |

### Query

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/query` | Ask a question (returns SSE stream with sources) |

**Query request body:**

```json
{
  "query": "How does authentication work?",
  "stream": true,
  "topK": 5,
  "model": "gemini-2.0-flash"
}
```

**Query response (SSE stream):**

```
data: {"type":"chunk","text":"The authentication system uses..."}
data: {"type":"done","answer":"...","sources":[...]}
```

---

## 📁 Project Structure

```
AIcodeBase/
├── client/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth.tsx             # Login/Register modal
│   │   │   ├── Chat.tsx             # RAG query interface
│   │   │   ├── Dashboard.tsx        # Landing page / project showcase
│   │   │   └── Layout.tsx           # App shell with sidebar
│   │   ├── utils/
│   │   │   └── api.ts              # API client
│   │   ├── App.tsx                  # Main app with routing
│   │   └── main.tsx                 # Entry point
│   ├── index.html
│   └── package.json
│
├── server/                          # Express backend
│   ├── config/
│   │   ├── config.js                # Environment config loader
│   │   
│   ├── controller/
│   │   ├── authController.js        # Register/Login logic
│   │   ├── indexController.js       # Code indexing controller
│   │   └── queryController.js       # RAG query controller (SSE)
│   ├── middleware/
│   │   └── authMiddleware.js        # JWT verification
│   ├── routes/
│   │   └── api.js                   # Route definitions
│   ├── utils/
│   │   ├── codeSplitter.js          # File → chunk splitting
│   │   ├── db.js                    # SQLite database layer
│   │   ├── ragEngine.js             # RAG engine (LLM orchestration)
│   │   └── vectorDb.js              # Vector search with embeddings
│   ├── data/                        # SQLite DB storage (gitignored)
│   ├── app.js                       # Express app setup
│   ├── index.js                     # Server entry point
│   └── package.json
│
└── README.md                        # This file
```

---

## 🔧 Development

### Server

```bash
cd server
npm run dev    # Nodemon auto-restart on changes
```

### Client

```bash
cd client
npm run dev    # Vite HMR at http://localhost:5173
```

---


## 📄 License

MIT — Free for personal and commercial use.

---

## 🙌 Contributing

Contributions are welcome! Feel free to open issues or submit PRs for:
- New provider integrations
- UI improvements
- Performance optimizations
- Documentation improvements
