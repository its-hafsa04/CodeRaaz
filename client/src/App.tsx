import { useState, useEffect } from 'react';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Chat, { type Message } from './components/Chat';
import LandingPage from './components/LandingPage';
import { setTokenFetcher } from './utils/api';
import './index.css';

type View = 'dashboard' | 'chat';

function MainApp() {
  const [view, setView] = useState<View>('dashboard');
  const [messages, setMessages] = useState<Message[]>([]);
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenFetcher(() => getToken());
  }, [getToken]);

  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <Layout activeView={view} onViewChange={setView}>
          {view === 'dashboard' ? <Dashboard /> : <Chat messages={messages} setMessages={setMessages} />}
        </Layout>
      </SignedIn>
    </>
  );
}

export default function App() {
  return <MainApp />;
}
