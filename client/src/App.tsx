import { useState, useEffect } from 'react';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Chat, { type Message } from './components/Chat';
import LandingPage from './components/LandingPage';
import { getChatSessions, getIndexStatus, getRepositories } from './utils/api';
import type { Repo } from './utils/api';
import { setTokenFetcher } from './utils/api';
import './index.css';

type View = 'dashboard' | 'chat';

function MainApp() {
  const [view, setView] = useState<View>('dashboard');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeRepository, setActiveRepository] = useState<Repo | null>(null);

  const { getToken } = useAuth();

  useEffect(() => {
    setTokenFetcher(() => getToken());

    let cancelled = false;
    async function restoreRepositoryContext() {
      try {
        const [status, repositories] = await Promise.all([getIndexStatus(), getRepositories()]);
        const persistedId = window.localStorage.getItem('activeRepositoryId');
        const persistedSessionId = window.localStorage.getItem('activeChatSessionId');
        const repoId = status.repoId || persistedId;
        if (!repoId) return;

        const repo = repositories.find(item => item.id === repoId);
        if (!repo) return;
        let sessionId = status.sessionId;
        if (!sessionId) {
          const sessions = await getChatSessions(repoId);
          sessionId = sessions.find(session => session.id === persistedSessionId)?.id || sessions[0]?.id;
        }
        if (!sessionId || cancelled) return;
        setActiveRepository(repo);
        setActiveRepoId(repo.id);
        setActiveSessionId(sessionId);
        window.localStorage.setItem('activeRepositoryId', repo.id);
        window.localStorage.setItem('activeChatSessionId', sessionId);
      } catch (error) {
        console.error('Unable to restore repository context:', error);
      }
    }

    restoreRepositoryContext();
    return () => { cancelled = true; };
  }, [getToken]);

  function handleActiveRepository(repoId: string, sessionId: string) {
    if (activeRepoId !== repoId) setMessages([]);
    setActiveRepoId(repoId);
    setActiveSessionId(sessionId);
    window.localStorage.setItem('activeRepositoryId', repoId);
    window.localStorage.setItem('activeChatSessionId', sessionId);
    getRepositories().then(repositories => {
      const repo = repositories.find(item => item.id === repoId) || null;
      setActiveRepository(repo);
    }).catch(error => console.error('Unable to load repository details:', error));
  }

  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <Layout activeView={view} onViewChange={setView}>
          {view === 'dashboard' ? (
            <Dashboard 
              setActiveRepo={(repoId, sessionId) => {
                handleActiveRepository(repoId, sessionId);
                setView('chat');
              }}
            />
          ) : (
            <Chat 
              messages={messages} 
              setMessages={setMessages} 
              activeRepoId={activeRepoId}
              activeSessionId={activeSessionId}
              activeRepository={activeRepository}
              setActiveRepo={handleActiveRepository}
            />
          )}
        </Layout>
      </SignedIn>
    </>
  );
}

export default function App() {
  return <MainApp />;
}
