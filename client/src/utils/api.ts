const API_BASE = '/api';

let getClerkToken: (() => Promise<string | null>) | null = null;

export function setTokenFetcher(fetcher: () => Promise<string | null>) {
  getClerkToken = fetcher;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (getClerkToken) {
    const token = await getClerkToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  return {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ---- Index ----
export async function startIndexing(dirPath?: string) {
  return request<{ message: string; targetDirectory: string }>('/index', {
    method: 'POST',
    body: JSON.stringify({ dirPath }),
  });
}

export async function clearIndex() {
  return request<{ message: string }>('/index', {
    method: 'DELETE',
  });
}

export interface IndexStatus {
  status: 'idle' | 'indexing' | 'completed' | 'failed';
  progress: { processed: number; total: number };
  error: string | null;
  filesIndexed: number;
  chunksIndexed: number;
  lastIndexedAt: string | null;
}

export async function getIndexStatus(): Promise<IndexStatus> {
  return request<IndexStatus>('/index/status');
}

export interface IndexFilesResponse {
  indexedDir: string;
  lastIndexed: string;
  totalFiles: number;
  files: string[];
}

export async function getIndexFiles(): Promise<IndexFilesResponse> {
  return request<IndexFilesResponse>('/index/files');
}

// ---- Query (Streaming SSE) ----
export interface Source {
  id: string;
  filePath: string;
  fileName: string;
  startLine: number;
  endLine: number;
  similarity: number;
  content?: string;
  language?: string;
}

export interface QueryStreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (answer: string, sources: Source[]) => void;
  onError: (error: string) => void;
}

export function queryStream(
  query: string,
  callbacks: QueryStreamCallbacks,
  TopK = 4
): () => void {
  let aborted = false;

  authHeaders().then(headers => {
    if (aborted) return;
    fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ query, stream: true, TopK }),
    }).then(async (res) => {
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        callbacks.onError(errText || `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'chunk') {
              callbacks.onChunk(event.text);
            } else if (event.type === 'done') {
              callbacks.onDone(event.answer, event.sources || []);
            } else if (event.type === 'error') {
              callbacks.onError(event.error);
            }
          } catch {}
        }
      }
    }).catch((err) => {
      if (!aborted) callbacks.onError(err.message);
    });
  });

  return () => { aborted = true; };
}
