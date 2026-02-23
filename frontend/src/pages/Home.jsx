import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function Home({ user, onMatchSelect }) {
  const [openMatches, setOpenMatches] = useState([]);
  const [myMatches,   setMyMatches]   = useState([]);
  const [creating,    setCreating]    = useState(false);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    try {
      const [o, m] = await Promise.all([api.getOpen(), api.getMy()]);
      setOpenMatches(o.matches);
      setMyMatches(m.matches);
    } catch (e) {
      console.error(e);
    }
  }

  async function createMatch() {
    setCreating(true);
    try {
      const d = await api.createMatch();
      onMatchSelect(d.match.id);
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function joinMatch(id) {
    try {
      await api.joinMatch(id);
      onMatchSelect(id);
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="home">
      <div className="home-header">
        <h1>🐾 ZooClash</h1>
        <p className="greeting">Hello, {user?.name || 'Player'}!</p>
      </div>

      <button className="btn-primary" onClick={createMatch} disabled={creating}>
        {creating ? 'Creating…' : '+ Create Match'}
      </button>

      {myMatches.length > 0 && (
        <section className="section">
          <h2>Your Active Matches</h2>
          {myMatches.map(m => (
            <div key={m.id} className="match-card clickable" onClick={() => onMatchSelect(m.id)}>
              <div className="match-info">
                <span className="match-id">#{m.id}</span>
                <span>{m.creator_name} vs {m.joiner_name || '???'}</span>
              </div>
              <span className={`status-badge s-${m.status}`}>{STATUS_LABELS[m.status]}</span>
            </div>
          ))}
        </section>
      )}

      <section className="section">
        <h2>Open Matches</h2>
        {openMatches.length === 0 ? (
          <p className="empty">No open matches — create one!</p>
        ) : (
          openMatches.map(m => (
            <div key={m.id} className="match-card">
              <div className="match-info">
                <span className="match-id">#{m.id}</span>
                <span>{m.creator_name} vs ???</span>
              </div>
              <button className="btn-secondary" onClick={() => joinMatch(m.id)}>Join</button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

const STATUS_LABELS = {
  waiting_for_joiner: '⏳ Waiting',
  setting_hands:      '🃏 Setting hands',
  guessing:           '🔍 Guessing',
  finished:           '🏁 Finished',
};
