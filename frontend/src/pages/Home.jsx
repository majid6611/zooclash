import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { shareMatch } from '../twa.js';

const AVATAR_COUNT = 10;

function avatarUrl(id) {
  return id ? `/avatars/${id}.webp` : null;
}

function AvatarPicker({ current, onSelect, onClose }) {
  const [saving, setSaving] = useState(false);

  async function pick(id) {
    if (saving) return;
    setSaving(true);
    try {
      await api.setAvatar(id);
      onSelect(id);
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="avatar-picker-backdrop" onClick={onClose}>
      <div className="avatar-picker-modal" onClick={e => e.stopPropagation()}>
        <h3>Choose Your Avatar</h3>
        <div className="avatar-grid">
          {Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1).map(id => (
            <button
              key={id}
              className={`avatar-option${current === id ? ' selected' : ''}`}
              onClick={() => pick(id)}
              disabled={saving}
            >
              <img src={avatarUrl(id)} alt={`Avatar ${id}`} />
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function ShareBadge({ matchId }) {
  function handleShare(e) {
    e.stopPropagation();
    shareMatch(matchId);
  }

  return (
    <button className="share-badge" onClick={handleShare}>
      📨
    </button>
  );
}

export default function Home({
  user,
  avatar,
  onAvatarChange,
  onMatchSelect,
  initialOpenMatches = [],
  initialMyMatches = [],
  initialLoaded = false,
}) {
  const [openMatches,   setOpenMatches]   = useState(initialOpenMatches);
  const [myMatches,     setMyMatches]     = useState(initialMyMatches);
  const [creating,      setCreating]      = useState(false);
  const [pickerOpen,    setPickerOpen]    = useState(false);
  const playerName = user?.name || user?.first_name || 'Player';
  const activeBattles = myMatches.filter(m => m.status !== 'finished').length;
  const finishedBattles = myMatches.length - activeBattles;

  useEffect(() => {
    if (!initialLoaded) {
      load();
    }
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
      <div className="home-overlay" />
      <div className="home-content">
        <div className="home-header">
          <img className="logo-image" src="/logo.png" alt="ZooClash" />
          <div className="header-player">
            <button className="avatar-btn" onClick={() => setPickerOpen(true)}>
              {avatar
                ? <img src={avatarUrl(avatar)} alt="avatar" />
                : <span className="avatar-placeholder">🐾</span>}
            </button>
            <h1>Welcome back, {playerName}!</h1>
          </div>
        </div>

        {pickerOpen && (
          <AvatarPicker
            current={avatar}
            onSelect={onAvatarChange}
            onClose={() => setPickerOpen(false)}
          />
        )}

        <div className="rank-bar">
          <span>🏆 Jungle Warrior</span>
          <span>🔥 {activeBattles}</span>
          <span>⭐ {finishedBattles}</span>
        </div>

        <button className="btn-primary clash-button" onClick={createMatch} disabled={creating}>
          {creating ? 'CREATING CLASH...' : '⚔ START A NEW CLASH'}
        </button>

        <section className="section">
          <h2>YOUR BATTLES</h2>
          {myMatches.length === 0 ? (
            <p className="empty">You do not have active battles yet.</p>
          ) : (
            myMatches.map(m => (
              <BattleCard
                key={m.id}
                match={m}
                leftName={m.creator_name}
                leftAvatar={m.creator_avatar}
                rightName={m.joiner_name || '????'}
                rightAvatar={m.joiner_avatar}
                status={m.status}
                onClick={() => onMatchSelect(m.id)}
                onShare={m.status === 'waiting_for_joiner' ? m.id : null}
              />
            ))
          )}
        </section>

        <section className="section">
          <h2>OPEN MATCHES</h2>
          {openMatches.length === 0 ? (
            <p className="empty">No open matches right now.</p>
          ) : (
            openMatches.map(m => (
              <BattleCard
                key={m.id}
                match={m}
                leftName={m.creator_name}
                leftAvatar={m.creator_avatar}
                rightName="????"
                status="open"
                onJoin={() => joinMatch(m.id)}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function AvatarThumb({ avatarId, fallback }) {
  if (avatarId) {
    return <img className="battle-avatar-img" src={avatarUrl(avatarId)} alt="avatar" />;
  }
  return <span className="battle-avatar-emoji">{fallback}</span>;
}

function BattleCard({ match, leftName, leftAvatar, rightName, rightAvatar, status, onClick, onJoin, onShare }) {
  const statusMeta = STATUS_META[status] || STATUS_META.waiting_for_joiner;
  const cardClassName = `battle-card ${onClick ? 'clickable' : ''}`;

  return (
    <article className={cardClassName} onClick={onClick}>
      <div className="battle-side battle-side-left">
        <div className="battle-avatar">
          <AvatarThumb avatarId={leftAvatar} fallback="🦁" />
        </div>
        <div className="battle-name-wrap">
          <p className="battle-name">{leftName}</p>
          <p className="battle-id">#{match.id}</p>
        </div>
      </div>

      <div className="battle-center">
        <p className="battle-vs">VS</p>
      </div>

      <div className="battle-side battle-side-right">
        <div className="battle-name-wrap right">
          <p className="battle-name">{rightName}</p>
          <p className={`battle-status tone-${statusMeta.tone}`}>{statusMeta.label}</p>
        </div>
        <div className="battle-avatar right">
          <AvatarThumb avatarId={rightAvatar} fallback={rightName === '????' ? '❔' : '🐺'} />
        </div>
      </div>

      {onJoin && (
        <button
          className="join-badge"
          onClick={(e) => {
            e.stopPropagation();
            onJoin();
          }}
        >
          JOIN
        </button>
      )}
      {onShare && <ShareBadge matchId={onShare} />}
    </article>
  );
}

const STATUS_META = {
  open:               { label: 'LIVE',      tone: 'live' },
  waiting_for_joiner: { label: 'WAITING',   tone: 'waiting' },
  setting_hands:      { label: 'LIVE',      tone: 'live' },
  guessing:           { label: 'YOUR TURN', tone: 'turn' },
  finished:           { label: 'FINISHED',  tone: 'finished' },
};
