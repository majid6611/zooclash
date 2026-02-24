import { useState, useEffect, useCallback } from 'react';
import { api, setToken } from './api.js';
import { getTelegramInitData, expandApp } from './twa.js';
import Home from './pages/Home.jsx';
import MatchPage from './pages/MatchPage.jsx';

const TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';
const MIN_SPLASH_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getInitialMatchId() {
  const raw = new URLSearchParams(window.location.search).get('match');
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function App() {
  const [user, setUser]               = useState(null);
  const [avatar, setAvatarState]      = useState(null);
  const [matchId, setMatchId]         = useState(getInitialMatchId);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [prefetch, setPrefetch]       = useState({
    openMatches: [],
    myMatches: [],
    animals: [],
    matchData: null,
    matchId: null,
    homePrefetched: false,
  });
  const handleBackToHome = useCallback(() => setMatchId(null), []);

  useEffect(() => {
    expandApp();
    bootstrap();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (matchId) {
      url.searchParams.set('match', String(matchId));
    } else {
      url.searchParams.delete('match');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [matchId]);

  async function bootstrap() {
    const startedAt = Date.now();
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
      setAvatarState(data.user.avatar || null);

      const preload = {
        openMatches: [],
        myMatches: [],
        animals: [],
        matchData: null,
        matchId: null,
        homePrefetched: false,
      };

      const animalsTask = api.getAnimals()
        .then(d => { preload.animals = d.animals || []; })
        .catch(() => {});

      if (matchId) {
        await Promise.all([
          animalsTask,
          api.getMatch(matchId)
            .then(d => {
              preload.matchData = d;
              preload.matchId = matchId;
            })
            .catch(() => {}),
        ]);
      } else {
        const [openResult, myResult] = await Promise.allSettled([api.getOpen(), api.getMy(), animalsTask]);
        if (openResult.status === 'fulfilled') {
          preload.openMatches = openResult.value.matches || [];
        }
        if (myResult.status === 'fulfilled') {
          preload.myMatches = myResult.value.matches || [];
        }
        preload.homePrefetched = openResult.status === 'fulfilled' && myResult.status === 'fulfilled';
      }

      setPrefetch(preload);
    } catch (err) {
      setError(err.message);
    } finally {
      const elapsed = Date.now() - startedAt;
      const remain = Math.max(0, MIN_SPLASH_MS - elapsed);
      if (remain > 0) {
        await sleep(remain);
      }
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="splash splash-image">
        <img className="splash-bg" src="/splash.webp" alt="ZooClash splash" />
      </div>
    );
  }
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
          initialAnimals={prefetch.animals}
          initialData={prefetch.matchId === matchId ? prefetch.matchData : null}
          onBack={handleBackToHome}
        />
      ) : (
        <Home
          user={user}
          avatar={avatar}
          onAvatarChange={setAvatarState}
          onMatchSelect={setMatchId}
          initialOpenMatches={prefetch.openMatches}
          initialMyMatches={prefetch.myMatches}
          initialLoaded={prefetch.homePrefetched}
        />
      )}
    </div>
  );
}
