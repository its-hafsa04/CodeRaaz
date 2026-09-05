import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, FileCode, ChevronDown, ChevronUp,
  Zap, Sparkles, X, ExternalLink, FolderOpen
} from 'lucide-react';
import { queryStream } from '../utils/api';
import type { Repo, Source } from '../utils/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  sources?: Source[];
}

interface SourcePanelProps {
  source: Source;
  onClose: () => void;
}

function SourcePanel({ source, onClose }: SourcePanelProps) {
  return (
    <div className="source-panel fade-in">
      <div className="source-panel-header">
        <div className="flex items-center gap-2">
          <FileCode size={15} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
            {source.fileName}
          </span>
          <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
            L{source.startLine}–{source.endLine}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {(source.similarity * 100).toFixed(1)}% match
          </span>
          <button id="close-source-panel" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>
      <div style={{
        padding: '8px 16px 12px',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        fontFamily: 'JetBrains Mono, monospace',
        borderBottom: '1px solid var(--border-subtle)',
        wordBreak: 'break-all'
      }}>
        {source.filePath}
      </div>
      {source.content && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {source.language || 'code'} · lines {source.startLine}-{source.endLine}
          </div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {source.content}
          </pre>
        </div>
      )}
      <div style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Click the source card in the message to view the code context.
      </div>
    </div>
  );
}

function SourceCard({
  source,
  index,
  onClick
}: {
  source: Source;
  index: number;
  onClick: () => void;
}) {
  const pct = (source.similarity * 100).toFixed(1);
  return (
    <button
      id={`source-card-${index}`}
      className="source-card"
      onClick={onClick}
      title={`${source.filePath}  L${source.startLine}–${source.endLine}`}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <FileCode size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {source.fileName}
        </span>
        <ExternalLink size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          L{source.startLine}–{source.endLine}
        </span>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: Number(pct) > 70 ? 'var(--success)' : 'var(--text-muted)' }}>
          {pct}%
        </span>
      </div>
    </button>
  );
}

function MessageBubble({ msg, onSourceClick }: { msg: Message; onSourceClick: (s: Source) => void }) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const isUser = msg.role === 'user';

  return (
    <div className={`message-row ${isUser ? 'message-user' : 'message-assistant'} fade-in`}>
      <div className="message-avatar">
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div className="message-body">
        <div className={`message-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
          {msg.streaming && !msg.content ? (
            <div className="typing-dots">
              <span /><span /><span />
            </div>
          ) : (
            <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          )}
          {msg.streaming && msg.content && (
            <span className="cursor-blink">▋</span>
          )}
        </div>

        {/* Sources */}
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="message-sources">
            <button
              id={`toggle-sources-${msg.id}`}
              className="btn btn-ghost btn-sm sources-toggle"
              onClick={() => setSourcesExpanded(v => !v)}
            >
              <FileCode size={12} />
              {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''} used
              {sourcesExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {sourcesExpanded && (
              <div className="sources-grid fade-in">
                {msg.sources.map((s, i) => (
                  <SourceCard key={i} source={s} index={i} onClick={() => onSourceClick(s)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown renderer (no external deps)
function renderMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_: string, lang: string, code: string) =>
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`
    )
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m: string) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[h1-6|ul|pre])(.*)/gm, (m: string) => m ? `<p>${m}</p>` : '')
    .replace(/<p><\/p>/g, '');
}

interface ChatProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  activeRepoId: string | null;
  activeSessionId: string | null;
  activeRepository: Repo | null;
  setActiveRepo?: (repoId: string, sessionId: string) => void;
}

export default function Chat({ messages, setMessages, activeRepoId, activeSessionId, activeRepository, setActiveRepo }: ChatProps) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState('');
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    import('../utils/api').then(({ getMessages }) => {
      if (activeSessionId) {
        getMessages(activeSessionId).then(msgs => {
          setMessages(msgs.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content
          })));
        }).catch(() => {
          setMessages([]);
        });
      } else {
        setMessages([]);
      }
    });
  }, [activeSessionId, setMessages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim()) sendMessage();
    }
  }

  function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || isStreaming) return;
    if (!activeRepoId || !activeSessionId) {
      setChatError('Please embed or select a repository before starting a chat.');
      return;
    }

    setChatError('');
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const assistantId = `a-${Date.now() + 1}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
      sources: [],
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    cancelRef.current = queryStream(
      text,
      activeRepoId || '',
      activeSessionId || '',
      {
        onChunk: (chunk) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          );
        },
        onDone: (_answer, sources) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, streaming: false, sources } : m)
          );
          setInput('');
          setIsStreaming(false);
          cancelRef.current = null;
        },
        onError: (err) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? {
              ...m, streaming: false,
              content: m.content || 'I could not analyze the repository right now. Please try again.'
            } : m)
          );
          console.error('Chat request failed:', err);
          setChatError('I could not analyze the repository right now. Your question is still here so you can retry.');
          setIsStreaming(false);
          cancelRef.current = null;
        },
      }
    );
  }

  function cancelStreaming() {
    if (cancelRef.current) {
      cancelRef.current();
      setIsStreaming(false);
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    }
  }

  const [repos, setRepos] = useState<{ id: string, name: string, url: string }[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (historyOpen) {
      import('../utils/api').then(({ getRepositories }) => {
        getRepositories().then(setRepos).catch(console.error);
      });
    }
  }, [historyOpen]);

  async function selectRepo(repoId: string) {
    const { getChatSessions, createChatSession } = await import('../utils/api');
    try {
      const existing = await getChatSessions(repoId);
      if (existing.length > 0) {
        setActiveRepo?.(repoId, existing[0].id);
      } else {
        const newSession = await createChatSession(repoId);
        setActiveRepo?.(repoId, newSession.id);
      }
    } catch (err) {
      console.error(err);
      setChatError('We could not switch to that repository. Please try again.');
    }
    setHistoryOpen(false);
  }

  return (
    <div className="chat-page">
      {/* Source Panel (right side) */}
      {selectedSource && (
        <SourcePanel source={selectedSource} onClose={() => setSelectedSource(null)} />
      )}

      <div className={`chat-main ${selectedSource ? 'chat-main-shifted' : ''}`}>
        {/* Chat Header */}
        <div className="chat-header" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <div className="flex items-center gap-3">
    <div className="chat-header-icon">
      <Sparkles size={18} />
    </div>
    <div>
      <h3 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
        <div>
          <div>AI Repository Assistant</div>
          <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>
            Ask questions about your codebase
          </span>
        </div>
        {activeRepository && (
          <span className="badge badge-success" title={activeRepository.url}>
            <span aria-hidden="true">●</span> {activeRepository.name} · Ready
          </span>
        )}
      </h3>
    </div>
  </div>

  <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
    {/* History Button & Dropdown */}
    <div style={{ position: 'relative' }}>
      <button 
        className="btn btn-ghost btn-sm" 
        onClick={() => setHistoryOpen(!historyOpen)}
        style={{ padding: '4px 8px' }}
      >
        <FolderOpen size={14} /> History <ChevronDown size={14} />
      </button>

      {historyOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '8px',
          background: 'var(--bg-sidebar)', border: '1px solid var(--border-subtle)',
          borderRadius: '8px', padding: '12px', zIndex: 100,
          width: '280px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Repository History</h4>
          {repos.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No repositories found.</div>
          ) : (
            repos.map(r => (
              <button 
                key={r.id}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start', padding: '8px', fontSize: '0.85rem' }}
                onClick={() => selectRepo(r.id)}
              >
                <FolderOpen size={14} /> {r.name}
                {r.id === activeRepoId && <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>Active</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>

    {/* New Chat Button */}
    <button
      id="clear-chat-btn"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        if (activeRepoId) {
           const { createChatSession } = await import('../utils/api');
           const session = await createChatSession(activeRepoId);
           setActiveRepo?.(activeRepoId, session.id);
           setMessages([]);
        }
      }}
      title="New Chat"
    >
      <Zap size={14} /> New Chat
    </button>

    {/* Cancel Streaming Button */}
    {isStreaming && (
      <button id="cancel-streaming-btn" className="btn btn-ghost btn-sm" onClick={cancelStreaming}>
        <X size={14} /> Cancel
      </button>
    )}
  </div>
</div>
        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty fade-in">
              <div className="chat-empty-icon">
                <Bot size={40} />
              </div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
                {activeRepoId ? 'Ready to explore your codebase' : 'Explore your repository with AI'}
              </h3>
              <p style={{ fontSize: '0.875rem', maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
                {activeRepoId
                  ? `You're now chatting with ${activeRepository?.name || 'your repository'}. Ask anything about your indexed code.`
                  : 'Embed a repository to start asking questions about your codebase.'}
              </p>
              {activeRepoId ? (
                <div className="chat-suggestions">
                  {[
                    'What does this project do?',
                    'Explain the project architecture.',
                    'Where is authentication implemented?',
                    'How does the API work?',
                    'Find potential bugs in this repository.',
                  ].map((q, i) => (
                    <button
                      key={i}
                      id={`suggestion-${i}`}
                      className="btn btn-ghost btn-sm suggestion-btn"
                      onClick={() => { setInput(q); sendMessage(q); }}
                    >
                      <Zap size={12} /> {q}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button className="btn btn-primary btn-sm" onClick={() => document.getElementById('nav-dashboard')?.click()}>
                    <FolderOpen size={14} /> Embed Repository
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setHistoryOpen(true)}>
                    Select from History
                  </button>
                </div>
              )}
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onSourceClick={setSelectedSource}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          {chatError && <div className="alert-error fade-in" style={{ marginBottom: 10 }}>{chatError}</div>}
          <div className="chat-input-wrap">
            <textarea
              id="chat-input"
              ref={textareaRef}
              className="chat-textarea"
              placeholder={activeRepoId ? 'Ask anything about your repository...' : 'Select a repository to start chatting...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={!activeRepoId || isStreaming}
            />
            <button
              id="send-message-btn"
              className="btn btn-primary chat-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
              title="Send (Enter)"
            >
              {isStreaming ? (
                <div className="spinner" style={{ width: 16, height: 16 }} />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            Powered by Gemini · RAG semantic retrieval · SQLite vector storage
          </p>
        </div>
      </div>

      <style>{`
        .chat-page {
          display: flex;
          height: 100%;
          overflow: hidden;
          position: relative;
        }
        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: margin-right 0.25s ease;
          min-width: 0;
        }
        .chat-main-shifted { margin-right: 320px; }
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-subtle);
          flex-shrink: 0;
          background: var(--bg-secondary);
          gap: 12px;
        }
        .chat-header-icon {
          width: 38px; height: 38px;
          background: var(--accent-gradient);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          box-shadow: 0 4px 12px rgba(99,102,241,0.3);
          flex-shrink: 0;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 60px 20px;
          gap: 16px;
        }
        .chat-empty-icon {
          width: 80px; height: 80px;
          background: rgba(99,102,241,0.12);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--accent-primary);
          border: 2px solid rgba(99,102,241,0.2);
        }
        .chat-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
          margin-top: 8px;
        }
        .suggestion-btn {
          font-size: 0.78rem !important;
          color: var(--text-secondary) !important;
        }
        .message-row {
          display: flex;
          gap: 12px;
          max-width: 900px;
        }
        .message-user {
          flex-direction: row-reverse;
          align-self: flex-end;
        }
        .message-assistant { align-self: flex-start; width: 100%; }
        .message-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 0.75rem;
        }
        .message-user .message-avatar {
          background: var(--accent-gradient);
          color: #fff;
          box-shadow: 0 2px 8px rgba(99,102,241,0.3);
        }
        .message-assistant .message-avatar {
          background: rgba(99,102,241,0.15);
          color: var(--accent-primary);
          border: 1px solid rgba(99,102,241,0.2);
        }
        .message-body { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
        .message-bubble {
          padding: 14px 18px;
          border-radius: var(--radius-lg);
          line-height: 1.7;
          font-size: 0.9rem;
          word-break: break-word;
        }
        .bubble-user {
          background: var(--accent-gradient);
          color: #fff;
          border-radius: var(--radius-lg) var(--radius-lg) 4px var(--radius-lg);
          max-width: 520px;
          margin-left: auto;
          box-shadow: 0 4px 15px rgba(99,102,241,0.3);
        }
        .bubble-user .prose { color: rgba(255,255,255,0.92); }
        .bubble-assistant {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px;
        }
        .cursor-blink {
          display: inline-block;
          color: var(--accent-primary);
          animation: blink 0.9s step-end infinite;
          margin-left: 2px;
        }
        @keyframes blink { 50% { opacity: 0; } }
        .message-sources { display: flex; flex-direction: column; gap: 8px; }
        .sources-toggle {
          align-self: flex-start;
          font-size: 0.78rem !important;
          color: var(--text-muted) !important;
          gap: 6px !important;
        }
        .sources-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 8px;
        }
        .source-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 10px 12px;
          text-align: left;
          cursor: pointer;
          transition: var(--transition);
          font-family: inherit;
          width: 100%;
        }
        .source-card:hover {
          border-color: var(--border-hover);
          background: var(--bg-card-hover);
          transform: translateY(-2px);
        }
        .chat-input-area {
          padding: 14px 20px 18px;
          border-top: 1px solid var(--border-subtle);
          flex-shrink: 0;
          background: var(--bg-secondary);
        }
        .chat-input-wrap {
          display: flex;
          gap: 10px;
          align-items: flex-end;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 10px 10px 10px 16px;
          transition: var(--transition);
        }
        .chat-input-wrap:focus-within {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .chat-textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-family: inherit;
          font-size: 0.9rem;
          line-height: 1.6;
          resize: none;
          max-height: 200px;
          overflow-y: auto;
          min-width: 0;
        }
        .chat-textarea::placeholder { color: var(--text-muted); }
        .chat-send-btn {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          padding: 0;
          border-radius: 10px;
        }
        .source-panel {
          position: absolute;
          right: 0; top: 0; bottom: 0;
          width: 320px;
          background: var(--bg-sidebar);
          border-left: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          z-index: 10;
        }
        .source-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--border-subtle);
          flex-shrink: 0;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          /* Source panel becomes full-width overlay on mobile */
          .source-panel {
            width: 100%;
            z-index: 50;
            border-left: none;
            border-top: 1px solid var(--border-subtle);
          }
          /* Don't shift the main content on mobile — overlay instead */
          .chat-main-shifted { margin-right: 0; }

          .chat-header {
            padding: 12px 14px;
          }
          .chat-messages {
            padding: 14px 12px;
            gap: 14px;
          }
          .chat-empty {
            padding: 40px 16px;
          }
          .chat-suggestions {
            flex-wrap: nowrap;
            overflow-x: auto;
            justify-content: flex-start;
            padding-bottom: 4px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .chat-suggestions::-webkit-scrollbar { display: none; }
          .suggestion-btn {
            white-space: nowrap !important;
            flex-shrink: 0;
          }
          .message-bubble {
            font-size: 0.875rem;
            padding: 12px 14px;
          }
          .bubble-user { max-width: 85vw; }
          .message-avatar { width: 28px; height: 28px; }
          .chat-input-area {
            padding: 10px 12px 14px;
          }
          .chat-input-wrap {
            padding: 8px 8px 8px 12px;
          }
          .chat-textarea { font-size: 1rem; } /* prevent iOS zoom on focus */
          .sources-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
        }

        @media (max-width: 480px) {
          .message-row { gap: 8px; }
          .message-avatar { display: none; } /* hide avatar on very small screens */
          .sources-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
