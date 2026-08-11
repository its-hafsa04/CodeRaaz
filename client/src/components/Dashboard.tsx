import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen, PlayCircle, CheckCircle2,
  XCircle, Loader2, File,
  ChevronDown, ChevronRight, Info, Trash2,
  MessageSquare
} from 'lucide-react';
import {
  startIndexing, getIndexStatus, getIndexFiles, clearIndex,
} from '../utils/api';
import type { IndexStatus, IndexFilesResponse } from '../utils/api';

export default function Dashboard() {
  const [dirPath, setDirPath] = useState('');
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [filesData, setFilesData] = useState<IndexFilesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filesExpanded, setFilesExpanded] = useState(false);
  const [polling, setPolling] = useState(false);
  const [indexPanelOpen, setIndexPanelOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await getIndexStatus();
      setStatus(s);
      return s;
    } catch {}
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      const f = await getIndexFiles();
      setFilesData(f);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchFiles();
  }, [fetchStatus, fetchFiles]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const s = await fetchStatus();
      if (s && s.status !== 'indexing') {
        setPolling(false);
        fetchFiles();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [polling, fetchStatus, fetchFiles]);

  async function handleIndex() {
    setError('');
    setLoading(true);
    try {
      await startIndexing(dirPath.trim() || undefined);
      setPolling(true);
      await fetchStatus();
      setIndexPanelOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to start indexing.');
    } finally {
      setLoading(false);
    }
  }

  async function handleClearIndex() {
    setError('');
    setLoading(true);
    try {
      await clearIndex();
      await fetchStatus();
      await fetchFiles();
      setFilesExpanded(false);
    } catch (err: any) {
      setError(err.message || 'Failed to clear the index.');
    } finally {
      setLoading(false);
    }
  }

  const isIndexing = status?.status === 'indexing';
  const progress = status?.progress
    ? status.progress.total > 0
      ? Math.round((status.progress.processed / status.progress.total) * 100)
      : 0
    : 0;

  function StatusBadge() {
    if (!status) return null;
    switch (status.status) {
      case 'idle':      return <span className="badge badge-info"><Info size={12}/> Idle</span>;
      case 'indexing':  return <span className="badge badge-warning"><Loader2 size={12} className="spin-icon"/> Indexing…</span>;
      case 'completed': return <span className="badge badge-success"><CheckCircle2 size={12}/> Ready</span>;
      case 'failed':    return <span className="badge badge-error"><XCircle size={12}/> Failed</span>;
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-content fade-in-up">
        
        {/* DASHBOARD HEADER */}
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-badge-row" style={{ justifyContent: 'flex-start', marginBottom: '12px' }}>
              <StatusBadge />
            </div>
            <h1 style={{ fontSize: '1.8rem', margin: '0 0 8px' }}>Index your codebase</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0', maxWidth: '600px' }}>
              Point the assistant at a repo, then chat with the indexed project using AI-backed retrieval.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => document.getElementById('nav-chat')?.click()}>
            <MessageSquare size={16} /> Open Chat
          </button>
        </div>

        {/* STATS SECTION */}
        <div className="stats-grid">
          <div className="stat-box glass-panel">
            <span className="stat-label">Files Indexed</span>
            <strong className="stat-value">{status?.filesIndexed ?? 0}</strong>
          </div>
          <div className="stat-box glass-panel">
            <span className="stat-label">Code Chunks</span>
            <strong className="stat-value">{status?.chunksIndexed ?? 0}</strong>
          </div>
          <div className="stat-box glass-panel">
            <span className="stat-label">Last Updated</span>
            <strong className="stat-value" style={{ fontSize: '1.2rem' }}>
              {status?.lastIndexedAt ? new Date(status.lastIndexedAt).toLocaleDateString() : 'Never'}
            </strong>
          </div>
        </div>

        {/* INDEXING PANEL */}
        <div className="glass-panel index-panel">
          <button
            className="panel-toggle-btn"
            onClick={() => setIndexPanelOpen(v => !v)}
          >
            <span className="panel-toggle-title">
              <FolderOpen size={18} style={{ color: 'var(--accent-primary)' }} /> Indexing Controls
            </span>
            {indexPanelOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          {indexPanelOpen && (
            <div className="panel-content fade-in">
              <div className="index-input-row">
                <div className="input-group flex-1">
                  <label className="input-label" htmlFor="dir-path-input">
                    Repository URL
                  </label>
                  <input
                    id="dir-path-input"
                    className="input premium-input"
                    type="text"
                    placeholder="e.g. https://github.com/owner/repo"
                    value={dirPath}
                    onChange={e => setDirPath(e.target.value)}
                    disabled={isIndexing}
                  />
                </div>
                <div className="index-actions">
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={handleClearIndex}
                    disabled={loading || isIndexing}
                    title="Clear index"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    className="btn btn-primary shine-effect index-start-btn"
                    onClick={handleIndex}
                    disabled={isIndexing || loading}
                  >
                    {isIndexing ? (
                      <><Loader2 size={16} className="spin-icon"/> Indexing…</>
                    ) : (
                      <><PlayCircle size={16} /> Start Indexing</>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="alert-error fade-in">
                  {error}
                </div>
              )}

              {isIndexing && (
                <div className="progress-section fade-in">
                  <div className="progress-header">
                    <span>Embedding chunks… 🚀</span>
                    <span>{status?.progress.processed} / {status?.progress.total} ({progress}%)</span>
                  </div>
                  <div className="progress-bar-wrap premium-progress">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FILES LIST */}
        {filesData && filesData.totalFiles > 0 ? (
          <div className="glass-panel files-panel">
            <button
              className="panel-toggle-btn"
              onClick={() => setFilesExpanded(v => !v)}
              style={{ marginBottom: filesExpanded ? 16 : 0 }}
            >
              <span className="panel-toggle-title">
                <File size={18} style={{ color: 'var(--accent-primary)' }} /> Indexed Files ({filesData.totalFiles})
              </span>
              {filesExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>

            {filesExpanded && (
              <div className="files-list fade-in">
                {filesData.files.map((f, i) => (
                  <div key={i} className="file-item interactive-hover">
                    <File size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span className="file-path">{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel empty-state">
            <FolderOpen size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>No files indexed yet. Connect a repository to start chatting! 💬</p>
          </div>
        )}
      </div>

      <style>{`
        .dashboard-page {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.08), transparent 40%),
                      radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.08), transparent 40%);
        }
        
        .dashboard-content {
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        /* Glassmorphism Panels */
        .glass-panel {
          background: rgba(30, 30, 36, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          padding: 24px;
        }

        /* Animations */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .interactive-hover {
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .interactive-hover:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(0,0,0,0.25);
          background: rgba(255, 255, 255, 0.03);
        }

        /* Hero Section */
        .hero-section {
          text-align: center;
          padding: 48px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .hero-section::before {
          content: '';
          position: absolute;
          top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle at center, rgba(99,102,241,0.05) 0%, transparent 50%);
          z-index: 0;
          pointer-events: none;
        }
        .hero-badge-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 20px;
          position: relative; z-index: 1;
        }
        .hero-title {
          font-size: 2.8rem;
          font-weight: 800;
          margin: 0 0 16px;
          background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1.2;
          position: relative; z-index: 1;
        }
        .hero-subtitle {
          font-size: 1.1rem;
          color: var(--text-secondary);
          max-width: 600px;
          margin: 0 0 32px;
          line-height: 1.6;
          position: relative; z-index: 1;
        }
        .hero-actions {
          display: flex;
          gap: 16px;
          position: relative; z-index: 1;
        }
        .btn-lg {
          padding: 0 24px;
          height: 48px;
          font-size: 1rem;
        }
        
        /* Shine Effect Button */
        .shine-effect {
          position: relative;
          overflow: hidden;
        }
        .shine-effect::after {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%);
          transform: skewX(-25deg);
          animation: shine 3s infinite;
        }
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 200%; }
          100% { left: 200%; }
        }

        /* Features Grid */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .feature-card {
          background: rgba(30, 30, 36, 0.4);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .feature-icon-wrap {
          width: 48px; height: 48px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        .feature-card h3 {
          margin: 0 0 10px;
          font-size: 1.15rem;
          color: var(--text-primary);
        }
        .feature-card p {
          margin: 0;
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .stat-box {
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .stat-label {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary);
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* Panels */
        .panel-toggle-btn {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: transparent;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0;
        }
        .panel-toggle-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.1rem;
          font-weight: 600;
        }
        .panel-content {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        /* Indexing Form */
        .index-input-row {
          display: flex;
          gap: 16px;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .premium-input {
          height: 48px;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 1rem;
        }
        .premium-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
        }
        .index-actions {
          display: flex;
          gap: 12px;
        }
        .index-start-btn {
          height: 48px;
          padding: 0 24px;
        }
        .btn-danger {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .btn-danger:hover { background: rgba(239, 68, 68, 0.2); }
        .btn-icon { height: 48px; width: 48px; padding: 0; display: flex; justify-content: center; align-items: center; }

        /* Progress */
        .progress-section { margin-top: 20px; }
        .progress-header {
          display: flex; justify-content: space-between;
          font-size: 0.85rem; color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .premium-progress {
          height: 8px;
          background: rgba(0,0,0,0.3);
          border-radius: 4px;
          overflow: hidden;
        }
        .premium-progress .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        /* Files List */
        .files-list {
          margin-top: 16px;
          max-height: 400px;
          overflow-y: auto;
          display: flex; flex-direction: column; gap: 8px;
        }
        .file-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px;
          background: rgba(0,0,0,0.15);
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 10px;
        }
        .file-path {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85rem;
          color: var(--text-secondary);
          word-break: break-all;
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: var(--text-muted);
          font-size: 1.1rem;
        }

        .alert-error {
          padding: 12px 16px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          margin-top: 16px;
          font-size: 0.9rem;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .stats-grid, .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .dashboard-content { padding: 16px 14px; gap: 16px; }
          .glass-panel { padding: 18px; border-radius: 14px; }
          .stats-grid, .features-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .stat-value { font-size: 1.6rem; }
          .hero-title { font-size: 1.5rem; }
          .panel-toggle-title { font-size: 1rem; }
          .index-input-row { flex-direction: column; align-items: stretch; }
          .index-actions { justify-content: flex-end; }
          .index-start-btn { width: 100%; justify-content: center; }
        }
        
        @media (max-width: 520px) {
          .dashboard-content { padding: 12px 10px; gap: 12px; }
          .glass-panel { padding: 16px; }
          .stats-grid, .features-grid { grid-template-columns: 1fr; gap: 10px; }
          .stat-box { flex-direction: row; align-items: center; justify-content: space-between; padding: 14px 16px; }
          .stat-label { font-size: 0.75rem; }
          .stat-value { font-size: 1.4rem; }
          .hero-section { padding: 24px 12px; }
          .hero-title { font-size: 1.35rem; }
          .hero-actions { flex-direction: column; width: 100%; }
          .hero-actions .btn { width: 100%; }
          .index-actions { flex-wrap: wrap; }
          .index-start-btn, .btn-icon { height: 44px; }
          .premium-input { height: 44px; font-size: 0.9rem; }
          .progress-header { font-size: 0.8rem; }
          .file-item { padding: 10px 12px; }
          .file-path { font-size: 0.78rem; }
          .empty-state { padding: 32px 16px; font-size: 0.95rem; }
        }
      `}</style>
    </div>
  );
}
