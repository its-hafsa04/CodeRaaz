import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { UserButton } from '@clerk/clerk-react';
import {
  Code2, LayoutDashboard, MessageSquare, ChevronLeft, ChevronRight, Menu, X
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeView: 'dashboard' | 'chat';
  onViewChange: (view: 'dashboard' | 'chat') => void;
}

export default function Layout({ children, activeView, onViewChange }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [activeView]);

  // Close on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const navItems: { id: 'dashboard' | 'chat'; icon: ReactNode; label: string }[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Indexing Dashboard' },
    { id: 'chat',      icon: <MessageSquare size={18} />,   label: 'AI Chat' },
  ];

  function SidebarContent({ isMobile }: { isMobile?: boolean }) {
    return (
      <>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Code2 size={20} />
          </div>
          {(!collapsed || isMobile) && (
            <div className="sidebar-logo-text">
              <span className="gradient-text">CodeRaaz</span>
              <span className="sidebar-logo-sub">AI Codebase Assistant</span>
            </div>
          )}
          {isMobile && (
            <button
              className="mobile-close-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="divider" style={{ margin: '0 12px' }} />

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
              title={!isMobile && collapsed ? item.label : undefined}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {(!collapsed || isMobile) && <span className="sidebar-nav-label">{item.label}</span>}
              {activeView === item.id && <div className="sidebar-nav-indicator" />}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: (!collapsed || isMobile) ? 'flex-start' : 'center', padding: (!collapsed || isMobile) ? '10px' : '10px 6px', gap: '12px' }}>
          <UserButton showName={!collapsed || isMobile} appearance={{ elements: { userButtonBox: { color: 'var(--text-primary)' } } }} />
        </div>

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button
            id="sidebar-collapse-toggle"
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </>
    );
  }

  return (
    <div className="layout-root">
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button
          id="mobile-menu-btn"
          className="btn btn-ghost btn-icon mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="sidebar-logo-icon" style={{ width: 32, height: 32, borderRadius: 8 }}>
          <Code2 size={16} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }} className="gradient-text">CodeRaaz</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <aside className={`sidebar sidebar-mobile-drawer ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <SidebarContent isMobile />
      </aside>

      {/* Desktop Sidebar */}
      <aside className={`sidebar sidebar-desktop ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="layout-main">
        {children}
      </main>

      <style>{`
        .layout-root {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: var(--bg-primary);
        }

        /* ── Desktop sidebar ── */
        .sidebar-desktop {
          width: 240px;
          min-width: 240px;
          transition: width 0.25s ease, min-width 0.25s ease;
        }
        .sidebar-desktop.sidebar-collapsed {
          width: 64px;
          min-width: 64px;
        }

        /* ── Shared sidebar base ── */
        .sidebar {
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          padding: 16px 8px;
          gap: 8px;
          position: relative;
          overflow: hidden;
        }

        /* ── Mobile drawer ── */
        .sidebar-mobile-drawer {
          display: none;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: 260px;
          z-index: 200;
          transform: translateX(-100%);
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
          box-shadow: 4px 0 24px rgba(0,0,0,0.5);
        }
        .sidebar-mobile-drawer.sidebar-mobile-open {
          transform: translateX(0);
        }
        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(2px);
          z-index: 199;
          animation: overlayFadeIn 0.2s ease;
        }
        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* ── Mobile top bar ── */
        .mobile-topbar {
          display: none;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border-subtle);
          z-index: 100;
          flex-shrink: 0;
        }
        .mobile-menu-btn {
          border: none !important;
          color: var(--text-secondary) !important;
        }
        .mobile-close-btn {
          margin-left: auto;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 6px;
          transition: var(--transition);
        }
        .mobile-close-btn:hover { color: var(--text-primary); background: var(--bg-card-hover); }

        /* ── Common sidebar internals ── */
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 8px 12px;
        }
        .sidebar-logo-icon {
          width: 38px; height: 38px;
          background: var(--accent-gradient);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(99,102,241,0.3);
        }
        .sidebar-logo-text {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          overflow: hidden;
          white-space: nowrap;
          flex: 1;
        }
        .sidebar-logo-text span:first-child { font-weight: 700; font-size: 1rem; }
        .sidebar-logo-sub { font-size: 0.7rem; color: var(--text-muted); }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-family: inherit;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: var(--transition);
          position: relative;
          white-space: nowrap;
          overflow: hidden;
          width: 100%;
          text-align: left;
        }
        .sidebar-nav-item:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }
        .sidebar-nav-item.active {
          background: rgba(99,102,241,0.15);
          color: var(--text-accent);
        }
        .sidebar-nav-icon { flex-shrink: 0; }
        .sidebar-nav-label { overflow: hidden; text-overflow: ellipsis; }
        .sidebar-nav-indicator {
          position: absolute;
          right: 0; top: 50%;
          transform: translateY(-50%);
          width: 3px; height: 20px;
          background: var(--accent-gradient);
          border-radius: 3px 0 0 3px;
        }
        .sidebar-footer {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px 4px;
          border-top: 1px solid var(--border-subtle);
          padding-top: 12px;
        }
        .sidebar-collapse-btn {
          position: absolute;
          top: 50%;
          right: -12px;
          transform: translateY(-50%);
          width: 24px; height: 24px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-muted);
          z-index: 10;
          transition: var(--transition);
        }
        .sidebar-collapse-btn:hover {
          color: var(--text-primary);
          background: var(--bg-card-hover);
        }
        .layout-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg-primary);
          min-width: 0;
        }

        /* ── Responsive breakpoints ── */
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile-drawer { display: flex; }
          .mobile-overlay { display: block; }
          .mobile-topbar { display: flex; }
          .layout-root { flex-direction: column; }
          .layout-main { flex: 1; overflow: hidden; }
        }
        @media (min-width: 769px) {
          .mobile-topbar { display: none !important; }
          .sidebar-mobile-drawer { display: none !important; }
          .mobile-overlay { display: none !important; }
        }
      `}</style>
    </div>
  );
}
