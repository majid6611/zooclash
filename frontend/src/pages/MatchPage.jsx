import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import CardArranger from '../components/CardArranger.jsx';
import { shareMatch } from '../twa.js';

const PHASE_LABELS = {
  waiting_for_joiner:  '⏳ Waiting',
  joiner_guessing:     '🔍 Round 1',
  joiner_setting_hand: '🃏 Round 2',
  creator_guessing:    '🔍 Round 2',
  finished:            '🏁 Finished',
};

function avatarUrl(id) {
  return id ? `/avatars/${id}.webp` : null;
}

export function AnimalImg({ animal, className = '' }) {
  return (
    <img
      src={`/animals/${animal}.webp`}
      alt={animal}
      className={`animal-img${className ? ' ' + className : ''}`}
    />
  );
}

function ShareButton({ matchId }) {
  return (
    <button className="btn-share" onClick={() => shareMatch(matchId)}>
      📨 Share via Telegram
    </button>
  );
}

// ── VS bar ──────────────────────────────────────────────────────────────────
function VsBar({ match, isCreator, isJoiner }) {
  const { creatorName, joinerName, creatorAvatar, joinerAvatar } = match;
  return (
    <div className="mp-vs-row">
      <div className={`mp-player${isCreator ? ' mp-me' : ''}`}>
        <div className="mp-avatar mp-avatar-left">
          {creatorAvatar
            ? <img src={avatarUrl(creatorAvatar)} alt={creatorName} />
            : <span className="mp-avatar-fallback">🦁</span>}
        </div>
        <p className="mp-name">{creatorName}</p>
      </div>

      <div className="mp-vs-text" aria-hidden="true" />

      <div className={`mp-player${isJoiner ? ' mp-me' : ''}`}>
        <div className="mp-avatar mp-avatar-right">
          {joinerAvatar
            ? <img src={avatarUrl(joinerAvatar)} alt={joinerName} />
            : <span className="mp-avatar-fallback">{joinerName ? '🐺' : '❔'}</span>}
        </div>
        <p className="mp-name">{joinerName || '???'}</p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function MatchPage({
  matchId,
  user,
  onBack,
  initialData = null,
}) {
  const [data,      setData]      = useState(initialData);
  const [loading,   setLoading]   = useState(!initialData);
  const [error,     setError]     = useState(null);
  const [lastGuess, setLastGuess] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    setData(initialData);
    setLoading(!initialData);
    setError(null);
    setLastGuess(null);

    if (!initialData) loadMatch();

    pollRef.current = setInterval(loadMatch, 3000);
    return () => clearInterval(pollRef.current);
  }, [matchId, initialData]);

  async function loadMatch() {
    try {
      const d = await api.getMatch(matchId);
      setData(d);
      setLastGuess(prev => (prev && d.match.status !== prev.forStatus) ? null : prev);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetHand(layout) {
    await api.setHand(matchId, layout);
    await loadMatch();
  }

  async function handleGuess(guess) {
    const result = await api.submitGuess(matchId, guess);
    if (result) setLastGuess({ ...result, forStatus: data?.match.status });
    await loadMatch();
    return result;
  }

  if (loading && !data) return <div className="splash">Loading match…</div>;
  if (error)            return <div className="splash error">⚠️ {error}</div>;
  if (!data)            return null;

  const { match, myHand, guesses, attemptsUsed, attemptsLeft, result, opponentLayout } = data;
  const animals = match.animals || [];
  const { myRole, status } = match;
  const isCreator = myRole === 'creator';
  const isJoiner  = myRole === 'joiner';
  const isCreatorSettingHand = status === 'waiting_for_joiner' && isCreator && !match.creatorHandSet;
  const isJoinerSettingHand = status === 'joiner_setting_hand' && isJoiner;
  const isSetupHandPhase = isCreatorSettingHand || isJoinerSettingHand;

  return (
    <div className="match-page">
      <div className="match-page-fx" />
      <div className="match-shell">
        {/* ── Header ── */}
        <div className="mp-header">
          <button className="btn-back-image mp-back-btn" onClick={onBack}>
            <img src="/back.png" alt="Back" />
          </button>
          <h2 className="mp-title">Match #{matchId}</h2>
          <span className={`mp-phase-badge p-${status}`}>{PHASE_LABELS[status]}</span>
        </div>

        {/* ── VS row ── */}
        <VsBar match={match} isCreator={isCreator} isJoiner={isJoiner} />

        {/* ── Phase content ── */}
        <div className={`mp-content${isSetupHandPhase ? ' mp-content-arrange' : ''}`}>

          {/* P1: set hand */}
          {isCreatorSettingHand && (
            <div className="mp-arranger-wrap">
              <CardArranger
                animals={animals}
                onSubmit={handleSetHand}
                label="Lock In Hand"
                btnClass="btn-lock btn-lock-main"
              />
            </div>
          )}

          {/* P1: hand locked, waiting */}
          {status === 'waiting_for_joiner' && isCreator && match.creatorHandSet && (
            <div className="mp-waiting">
              <div className="big-emoji">✅</div>
              <p className="mp-section-title">Hand locked!</p>
              <div className="hand-preview">
                {myHand?.map(a => (
                  <div key={a} className="emoji-card">
                    <AnimalImg animal={a} />
                  </div>
                ))}
              </div>
              <p className="hint">Waiting for an opponent to join…</p>
              <ShareButton matchId={matchId} />
            </div>
          )}

          {/* Joiner pre-joined via invite: waiting for creator to lock hand */}
          {status === 'waiting_for_joiner' && isJoiner && (
            <div className="mp-waiting">
              <div className="big-emoji">⏳</div>
              <p className="mp-section-title">Invite Accepted!</p>
              <p className="hint">Waiting for {match.creatorName} to lock in their hand…</p>
            </div>
          )}

          {/* Joiner: guess P1's hand */}
          {status === 'joiner_guessing' && isJoiner && (
            <>
              <p className="mp-section-title">Guess {match.creatorName}'s hand</p>
              <GuessingPanel
                animals={animals} guesses={guesses}
                attemptsUsed={attemptsUsed} attemptsLeft={attemptsLeft}
                lastGuess={lastGuess} onGuess={handleGuess}
              />
            </>
          )}

          {/* Creator: wait while joiner guesses */}
          {status === 'joiner_guessing' && isCreator && (
            <div className="mp-waiting">
              <div className="big-emoji">🔍</div>
              <p className="mp-section-title">{match.joinerName} is guessing your hand…</p>
              <div className="hand-preview">
                {myHand?.map(a => (
                  <div key={a} className="emoji-card">
                    <AnimalImg animal={a} />
                  </div>
                ))}
              </div>
              <p className="hint">Sit tight!</p>
            </div>
          )}

          {/* Joiner: set own hand */}
          {isJoinerSettingHand && (
            <div className="mp-arranger-wrap">
              <p className="mp-section-title">Now set your secret hand</p>
              <p className="hint">{match.creatorName} will try to guess yours!</p>
              <CardArranger
                animals={animals}
                onSubmit={handleSetHand}
                label="Lock In Hand"
                btnClass="btn-lock btn-lock-main"
              />
            </div>
          )}

          {/* Creator: wait while joiner sets hand */}
          {status === 'joiner_setting_hand' && isCreator && (
            <div className="mp-waiting">
              <div className="big-emoji">🃏</div>
              <p className="mp-section-title">{match.joinerName} is setting their hand…</p>
              <p className="hint">Get ready to guess!</p>
            </div>
          )}

          {/* Creator: guess joiner's hand */}
          {status === 'creator_guessing' && isCreator && (
            <>
              <p className="mp-section-title">Guess {match.joinerName}'s hand</p>
              <GuessingPanel
                animals={animals} guesses={guesses}
                attemptsUsed={attemptsUsed} attemptsLeft={attemptsLeft}
                lastGuess={lastGuess} onGuess={handleGuess}
              />
            </>
          )}

          {/* Joiner: wait while creator guesses */}
          {status === 'creator_guessing' && isJoiner && (
            <div className="mp-waiting">
              <div className="big-emoji">🔍</div>
              <p className="mp-section-title">{match.creatorName} is guessing your hand…</p>
              <p className="hint">Almost done!</p>
            </div>
          )}

          {/* Finished */}
          {status === 'finished' && result && (
            <ResultsPanel
              match={match} result={result}
              myHand={myHand} opponentLayout={opponentLayout}
              guesses={guesses} isCreator={isCreator} onBack={onBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Guessing panel ───────────────────────────────────────────────────────────
function GuessingPanel({ animals, guesses, attemptsUsed, attemptsLeft, lastGuess, onGuess }) {
  return (
    <>
      <div className="attempts-bar">
        <span>Attempts: {attemptsUsed} / 10</span>
        <span className="attempts-left">Left: {attemptsLeft}</span>
      </div>

      {guesses.length > 0 && (
        <div className="guess-history">
          {guesses.map(g => (
            <div key={g.attempt_number} className={`guess-row${g.is_correct ? ' correct' : ''}`}>
              <span className="g-num">#{g.attempt_number}</span>
              <span className="g-animals">
                {g.guess.map((a, i) => (
                  <AnimalImg key={i} animal={a} className="emoji-sm" />
                ))}
              </span>
              <span className="g-score">{g.is_correct ? '✅' : `✓ ${g.correct_positions}/5`}</span>
            </div>
          ))}
        </div>
      )}

      {lastGuess && !lastGuess.isCorrect && (
        <div className="feedback-bar">Last guess: {lastGuess.correctPositions}/5 correct positions</div>
      )}
      {lastGuess?.isCorrect && (
        <div className="feedback-bar correct">🎉 Correct!</div>
      )}

      {attemptsLeft > 0 && !lastGuess?.isCorrect && (
        <>
          <p className="mp-section-title">Your guess:</p>
          <CardArranger animals={animals} onSubmit={onGuess} label="Submit Guess" btnClass="btn-lock btn-guess" />
        </>
      )}

      {attemptsLeft === 0 && !lastGuess?.isCorrect && (
        <div className="feedback-bar">No attempts remaining — waiting for next phase…</div>
      )}
    </>
  );
}

// ── Results panel ────────────────────────────────────────────────────────────
function ResultsPanel({ match, result, myHand, opponentLayout, guesses, isCreator, onBack }) {
  const myPoints  = isCreator ? result.creator_match_points : result.joiner_match_points;
  const myScore   = isCreator ? result.creator_guess_score  : result.joiner_guess_score;
  const oppPoints = isCreator ? result.joiner_match_points  : result.creator_match_points;
  const oppScore  = isCreator ? result.joiner_guess_score   : result.creator_guess_score;
  const oppName   = isCreator ? match.joinerName            : match.creatorName;

  return (
    <div className="panel results">
      <h3>🏁 Match Finished!</h3>
      <div className="result-hero">
        {result.is_draw    ? '🤝 Draw!'
          : myPoints === 3 ? '🏆 You Won!'
          : '😔 You Lost'}
      </div>

      <div className="scores">
        <div className="score-col">
          <div className="score-name">You</div>
          <div>GuessScore: <strong>{myScore}</strong></div>
          <div>Points: <strong>{myPoints}</strong></div>
        </div>
        <div className="score-divider">vs</div>
        <div className="score-col">
          <div className="score-name">{oppName}</div>
          <div>GuessScore: <strong>{oppScore}</strong></div>
          <div>Points: <strong>{oppPoints}</strong></div>
        </div>
      </div>

      {myHand && (
        <div className="reveal">
          <p>Your hand was:</p>
          <div className="hand-preview">
            {myHand.map(a => (
              <div key={a} className="emoji-card">
                <AnimalImg animal={a} />
              </div>
            ))}
          </div>
        </div>
      )}

      {opponentLayout && (
        <div className="reveal">
          <p>{oppName}'s hand was:</p>
          <div className="hand-preview">
            {opponentLayout.map(a => (
              <div key={a} className="emoji-card">
                <AnimalImg animal={a} />
              </div>
            ))}
          </div>
        </div>
      )}

      {guesses.length > 0 && (
        <div className="guess-history">
          <h4>Your guesses:</h4>
          {guesses.map(g => (
            <div key={g.attempt_number} className={`guess-row${g.is_correct ? ' correct' : ''}`}>
              <span className="g-num">#{g.attempt_number}</span>
              <span className="g-animals">
                {g.guess.map((a, i) => (
                  <AnimalImg key={i} animal={a} className="emoji-sm" />
                ))}
              </span>
              <span className="g-score">{g.is_correct ? '✅' : `✓ ${g.correct_positions}/5`}</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn-lock btn-lock-small" onClick={onBack}>Back to Lobby</button>
    </div>
  );
}
