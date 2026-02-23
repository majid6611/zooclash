import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import CardArranger from '../components/CardArranger.jsx';

export const ANIMAL_EMOJI = {
  lion:     '🦁',
  tiger:    '🐯',
  elephant: '🐘',
  giraffe:  '🦒',
  zebra:    '🦓',
};

const PHASE_LABELS = {
  waiting_for_joiner:  '⏳ Waiting',
  joiner_guessing:     '🔍 Joiner Guessing',
  joiner_setting_hand: '🃏 Joiner Setting Hand',
  creator_guessing:    '🔍 Creator Guessing',
  finished:            '🏁 Finished',
};

export default function MatchPage({ matchId, user, onBack }) {
  const [data,      setData]      = useState(null);
  const [animals,   setAnimals]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastGuess, setLastGuess] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    api.getAnimals().then(d => setAnimals(d.animals));
    loadMatch();
    pollRef.current = setInterval(loadMatch, 3000);
    return () => clearInterval(pollRef.current);
  }, [matchId]);

  async function loadMatch() {
    try {
      const d = await api.getMatch(matchId);
      setData(d);
      // Reset lastGuess feedback when phase changes
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
    if (result) {
      setLastGuess({ ...result, forStatus: data?.match.status });
    }
    await loadMatch();
    return result;
  }

  if (loading && !data) return <div className="splash">Loading match…</div>;
  if (error)            return <div className="splash error">⚠️ {error}</div>;
  if (!data)            return null;

  const { match, myHand, guesses, attemptsUsed, attemptsLeft, result, opponentLayout } = data;
  const { myRole, status } = match;
  const isCreator = myRole === 'creator';
  const isJoiner  = myRole === 'joiner';

  // Determine if it's currently MY turn to act
  const myTurnToGuess =
    (isJoiner  && status === 'joiner_guessing')  ||
    (isCreator && status === 'creator_guessing');

  const myTurnToSetHand =
    (isCreator && status === 'waiting_for_joiner' && !match.creatorHandSet) ||
    (isJoiner  && status === 'joiner_setting_hand');

  const waiting =
    (isCreator && status === 'joiner_guessing')     ||
    (isCreator && status === 'joiner_setting_hand') ||
    (isJoiner  && status === 'creator_guessing');

  return (
    <div className="match-page">
      <div className="match-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2>Match #{matchId}</h2>
        <span className={`phase-badge p-${status}`}>{PHASE_LABELS[status]}</span>
      </div>

      <div className="vs-row">
        <span className={isCreator ? 'me' : ''}>{match.creatorName}</span>
        <span className="vs">vs</span>
        <span className={isJoiner  ? 'me' : ''}>{match.joinerName || '???'}</span>
      </div>

      {/* ── P1 sets hand (before anyone joins) ── */}
      {status === 'waiting_for_joiner' && isCreator && !match.creatorHandSet && (
        <div className="panel">
          <h3>🃏 Set your secret hand</h3>
          <p className="hint">Arrange the animals — your opponent will have to guess this order!</p>
          <CardArranger animals={animals} onSubmit={handleSetHand} label="🔒 Lock In Hand" />
        </div>
      )}

      {/* ── P1 waiting after locking hand ── */}
      {status === 'waiting_for_joiner' && isCreator && match.creatorHandSet && (
        <div className="panel center">
          <div className="big-emoji">✅</div>
          <p>Your hand is locked!</p>
          <div className="hand-preview">
            {myHand?.map(a => <span key={a} className="emoji-card">{ANIMAL_EMOJI[a]}</span>)}
          </div>
          <p className="hint">⏳ Waiting for an opponent to join…<br />Share <strong>Match #{matchId}</strong>!</p>
        </div>
      )}

      {/* ── JOINER: guess P1's hand ── */}
      {status === 'joiner_guessing' && isJoiner && (
        <div className="panel">
          <div className="round-label">Round 1 — Guess {match.creatorName}'s hand</div>
          <GuessingPanel
            animals={animals}
            guesses={guesses}
            attemptsUsed={attemptsUsed}
            attemptsLeft={attemptsLeft}
            lastGuess={lastGuess}
            onGuess={handleGuess}
          />
        </div>
      )}

      {/* ── CREATOR: wait while joiner guesses ── */}
      {status === 'joiner_guessing' && isCreator && (
        <div className="panel center">
          <div className="big-emoji">🔍</div>
          <p>{match.joinerName} is guessing your hand…</p>
          <div className="hand-preview">
            {myHand?.map(a => <span key={a} className="emoji-card">{ANIMAL_EMOJI[a]}</span>)}
          </div>
          <p className="hint">Sit tight!</p>
        </div>
      )}

      {/* ── JOINER: set their own hand ── */}
      {status === 'joiner_setting_hand' && isJoiner && (
        <div className="panel">
          <div className="round-label">Round 2 — Set your secret hand</div>
          <p className="hint">Now it's {match.creatorName}'s turn to guess yours!</p>
          <CardArranger animals={animals} onSubmit={handleSetHand} label="🔒 Lock In Hand" />
        </div>
      )}

      {/* ── CREATOR: wait while joiner sets hand ── */}
      {status === 'joiner_setting_hand' && isCreator && (
        <div className="panel center">
          <div className="big-emoji">🃏</div>
          <p>{match.joinerName} is setting their secret hand…</p>
          <p className="hint">Get ready to guess!</p>
        </div>
      )}

      {/* ── CREATOR: guess joiner's hand ── */}
      {status === 'creator_guessing' && isCreator && (
        <div className="panel">
          <div className="round-label">Round 2 — Guess {match.joinerName}'s hand</div>
          <GuessingPanel
            animals={animals}
            guesses={guesses}
            attemptsUsed={attemptsUsed}
            attemptsLeft={attemptsLeft}
            lastGuess={lastGuess}
            onGuess={handleGuess}
          />
        </div>
      )}

      {/* ── JOINER: wait while creator guesses ── */}
      {status === 'creator_guessing' && isJoiner && (
        <div className="panel center">
          <div className="big-emoji">🔍</div>
          <p>{match.creatorName} is guessing your hand…</p>
          <p className="hint">Almost done!</p>
        </div>
      )}

      {/* ── FINISHED ── */}
      {status === 'finished' && result && (
        <ResultsPanel
          match={match}
          result={result}
          myHand={myHand}
          opponentLayout={opponentLayout}
          guesses={guesses}
          userId={user?.id}
          isCreator={isCreator}
          onBack={onBack}
        />
      )}
    </div>
  );
}

// ── Guessing sub-component ──────────────────────────────────────────────────
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
                {g.guess.map((a, i) => <span key={i} className="emoji-sm">{ANIMAL_EMOJI[a]}</span>)}
              </span>
              <span className="g-score">{g.is_correct ? '✅' : `✓ ${g.correct_positions}/5`}</span>
            </div>
          ))}
        </div>
      )}

      {lastGuess && !lastGuess.isCorrect && (
        <div className="feedback-bar">
          Last guess: {lastGuess.correctPositions}/5 correct positions
        </div>
      )}
      {lastGuess?.isCorrect && (
        <div className="feedback-bar correct">🎉 Correct!</div>
      )}

      {attemptsLeft > 0 && !lastGuess?.isCorrect && (
        <>
          <h3>Your guess:</h3>
          <CardArranger animals={animals} onSubmit={onGuess} label="🔍 Submit Guess" />
        </>
      )}

      {attemptsLeft === 0 && !lastGuess?.isCorrect && (
        <div className="feedback-bar">No attempts remaining — waiting for next phase…</div>
      )}
    </>
  );
}

// ── Results sub-component ───────────────────────────────────────────────────
function ResultsPanel({ match, result, myHand, opponentLayout, guesses, userId, isCreator, onBack }) {
  const myPoints  = isCreator ? result.creator_match_points : result.joiner_match_points;
  const myScore   = isCreator ? result.creator_guess_score  : result.joiner_guess_score;
  const oppPoints = isCreator ? result.joiner_match_points  : result.creator_match_points;
  const oppScore  = isCreator ? result.joiner_guess_score   : result.creator_guess_score;
  const oppName   = isCreator ? match.joinerName            : match.creatorName;

  return (
    <div className="panel results">
      <h3>🏁 Match Finished!</h3>

      <div className="result-hero">
        {result.is_draw     ? '🤝 Draw!'
          : myPoints === 3  ? '🏆 You Won!'
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
            {myHand.map(a => <span key={a} className="emoji-card">{ANIMAL_EMOJI[a]}</span>)}
          </div>
        </div>
      )}

      {opponentLayout && (
        <div className="reveal">
          <p>{oppName}'s hand was:</p>
          <div className="hand-preview">
            {opponentLayout.map(a => <span key={a} className="emoji-card">{ANIMAL_EMOJI[a]}</span>)}
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
                {g.guess.map((a, i) => <span key={i} className="emoji-sm">{ANIMAL_EMOJI[a]}</span>)}
              </span>
              <span className="g-score">{g.is_correct ? '✅' : `✓ ${g.correct_positions}/5`}</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn-primary" onClick={onBack}>Back to Lobby</button>
    </div>
  );
}
