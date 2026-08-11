import {
  Code2, Zap, Database, Cpu, Shield,
  ArrowRight, LogIn, Sparkles, Search, Bot
} from 'lucide-react';
import { SignInButton } from '@clerk/clerk-react';

export default function LandingPage() {
  const features = [
    {
      icon: <Search size={22} />,
      title: 'RAG-Powered Search',
      desc: 'Semantic code search across your entire codebase using vector embeddings and cosine similarity.',
    },
    {
      icon: <Bot size={22} />,
      title: 'AI Code Assistant',
      desc: 'Ask natural language questions about your code and get contextual answers grounded in your source files.',
    },
    {
      icon: <Database size={22} />,
      title: 'Vector Database',
      desc: 'Vector database stored seamlessly with no complex external dependencies.',
    },
    {
      icon: <Cpu size={22} />,
      title: 'Lightning Fast',
      desc: 'Powered by Gemini & Groq for instant embeddings and incredibly fast chat responses.',
    },
    {
      icon: <Shield size={22} />,
      title: 'Secure Authentication',
      desc: 'Multi-user auth managed fully securely using Clerk. Safe, fast, and encrypted.',
    },
    {
      icon: <Zap size={22} />,
      title: 'Incremental Indexing',
      desc: 'Smart hash-based change detection. Only re-index what changed.',
    },
  ];

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="landing-brand-icon"><Code2 size={20} /></div>
            <span className="landing-brand-text">Code <span className="gradient-text">Raaz</span></span>
          </div>
          <div className="landing-nav-actions">
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-sm shine-effect">
                <LogIn size={14} style={{ marginRight: '6px' }} /> Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content fade-in-up">
          <div className="landing-hero-badges">
            <span className="badge badge-purple"><Sparkles size={11} /> RAG-Powered</span>
            <span className="badge badge-accent"><Zap size={11} /> Lightning Fast</span>
            <span className="badge badge-info"><Shield size={11} /> Secure</span>
          </div>
          <h1 className="landing-hero-title">
            Your Intelligent<br />
            <span className="gradient-text">Codebase Companion</span>
          </h1>
          <p className="landing-hero-sub">
            Index your project, ask questions in natural language, and get instant context-aware
            answers about your code — powered by Gemini and Groq.
          </p>
          <div className="landing-hero-cta">
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-lg shine-effect">
                Get Started <ArrowRight size={18} style={{ marginLeft: '8px' }} />
              </button>
            </SignInButton>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-header">
          <h2>Everything you need</h2>
          <p>A complete suite of tools to understand, search, and chat with your entire codebase.</p>
        </div>
        <div className="landing-features-grid">
          {features.map((f, i) => (
            <div key={i} className="landing-feature-card interactive-hover">
              <div className="landing-feature-icon">
                {f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <Code2 size={16} />  <span className="gradient-text">CodeRaaz</span> 
            AI Codebase Assistant
          </div>
          <div className="landing-footer-text">
            © 2026 CodeRaaz. All rights reserved.
          </div>
        </div>
      </footer>

      <style>{`
        .landing-page { min-height: 100vh; background: var(--bg-primary); display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
        .landing-nav { position: sticky; top: 0; z-index: 100; background: rgba(30, 30, 36, 0.6); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border-subtle); }
        .landing-nav-inner { max-width: 1200px; margin: 0 auto; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
        .landing-brand { display: flex; align-items: center; gap: 10px; }
        .landing-brand-icon { width: 34px; height: 34px; background: var(--accent-gradient); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; }
        .landing-brand-text { font-weight: 700; font-size: 1rem; color: var(--text-primary); }
        .gradient-text { background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        
        .landing-hero { position: relative; padding: 100px 24px 80px; overflow: hidden; }
        .landing-hero-bg { position: absolute; inset: 0; background: radial-gradient(circle at 30% 40%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(139,92,246,0.08) 0%, transparent 50%); pointer-events: none; }
        .landing-hero-content { position: relative; max-width: 800px; margin: 0 auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 24px; }
        .landing-hero-badges { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .landing-hero-title { font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 800; line-height: 1.1; color: var(--text-primary); }
        .landing-hero-sub { font-size: 1.15rem; color: var(--text-secondary); max-width: 640px; line-height: 1.6; }
        .landing-hero-cta { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
        
        .landing-section { padding: 80px 24px; max-width: 1200px; margin: 0 auto; width: 100%; }
        .landing-section-header { text-align: center; margin-bottom: 48px; }
        .landing-section-header h2 { font-size: 2.2rem; font-weight: 800; color: var(--text-primary); margin-bottom: 12px; }
        .landing-section-header p { color: var(--text-muted); font-size: 1.1rem; max-width: 600px; margin: 0 auto; }
        
        .landing-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        
        .landing-feature-card { background: rgba(30, 30, 36, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 32px; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        .landing-feature-card:hover { border-color: rgba(255,255,255,0.1); transform: translateY(-4px); box-shadow: 0 10px 24px rgba(0,0,0,0.25); background: rgba(255,255,255,0.03); }
        .landing-feature-icon { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; margin-bottom: 20px; background: rgba(255,255,255,0.05); }
        .landing-feature-card h3 { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; }
        .landing-feature-card p { font-size: 1rem; color: var(--text-secondary); line-height: 1.6; }
        
        .landing-footer { border-top: 1px solid rgba(255,255,255,0.05); padding: 32px 24px; margin-top: auto; }
        .landing-footer-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
        .landing-footer-brand { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-weight: 600; }
        .landing-footer-text { color: var(--text-muted); font-size: 0.9rem; }
        
        .shine-effect { position: relative; overflow: hidden; }
        .shine-effect::after { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%); transform: skewX(-25deg); animation: shine 3s infinite; }
        @keyframes shine { 0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; } }
        
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @media (max-width: 900px) {
          .landing-features-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 650px) {
          .landing-hero { padding: 60px 16px 40px; }
          .landing-hero-title { font-size: 2.2rem; }
          .landing-features-grid { grid-template-columns: 1fr; }
          .landing-section { padding: 40px 16px; }
          .landing-footer-inner { flex-direction: column; gap: 16px; text-align: center; }
        }
      `}</style>
    </div>
  );
}
