import { useState, useEffect } from 'react';
import { api, setToken } from './api.js';
import { getTelegramInitData, expandApp } from './twa.js';
import Home from './pages/Home.jsx';
import MatchPage from './pages/MatchPage.jsx';

const TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';

export default function App() {
  const [user, setUser]               = useState(null);
  const [matchId, setMatchId]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  useEffect(() => {
    expandApp();
    authenticate();
  }, []);

  async function authenticate() {
    try {
      const initData = getTelegramInitData();

      let testUser = null;
      if (TEST_MODE && !initData) {
        // Allow switching test accounts via URL param ?uid=2
        const uid = new URLSearchParams(window.location.search).get('uid') || '1';
        testUser = { id: parseInt(uid), first_name: `TestUser${uid}`, username: `testuser${uid}` };
      }

      const data = await api.auth(initData, testUser);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="splash">🐾<br />Loading ZooClash…</div>;
  if (error)   return <div className="splash error">⚠️ {error}</div>;

  return (
    <div className="app">
      {TEST_MODE && (
        <div className="test-banner">⚠️ TEST MODE — development only</div>
      )}

      {matchId ? (
        <MatchPage
          matchId={matchId}
          user={user}
          onBack={() => setMatchId(null)}
        />
      ) : (
        <Home user={user} onMatchSelect={setMatchId} />
      )}
    </div>
  );
}
