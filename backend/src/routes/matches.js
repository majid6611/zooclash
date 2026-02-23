import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';
import {
  validateLayout,
  countCorrectPositions,
  calculateGuessScore,
  determineWinner,
  ANIMALS,
  MAX_GUESSES,
} from '../game.js';
import {
  notifyMove,
  notifyYourTurn,
  notifyFinished,
} from '../bot.js';

const router = Router();

async function getUser(userId) {
  const r = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return r.rows[0];
}

async function getMatchFull(matchId) {
  const r = await pool.query(`
    SELECT m.*,
      c.telegram_id AS creator_telegram_id, c.first_name AS creator_name,
      j.telegram_id AS joiner_telegram_id,  j.first_name AS joiner_name
    FROM matches m
    LEFT JOIN users c ON m.creator_id = c.id
    LEFT JOIN users j ON m.joiner_id  = j.id
    WHERE m.id = $1
  `, [matchId]);
  return r.rows[0] || null;
}

// GET /api/matches/animals
router.get('/animals', (req, res) => {
  res.json({ animals: ANIMALS });
});

// GET /api/matches/open  — only matches where creator already set hand
router.get('/open', authMiddleware, async (req, res) => {
  const testMode = process.env.TEST_MODE === 'true';

  const result = await pool.query(`
    SELECT m.id, m.status, m.created_at,
      c.first_name AS creator_name
    FROM matches m
    JOIN users c ON m.creator_id = c.id
    WHERE m.status = 'waiting_for_joiner'
      AND m.creator_hand_set = TRUE
      ${testMode ? '' : 'AND m.creator_id != $1'}
    ORDER BY m.created_at DESC
    LIMIT 20
  `, testMode ? [] : [req.userId]);

  res.json({ matches: result.rows });
});

// GET /api/matches/my
router.get('/my', authMiddleware, async (req, res) => {
  const result = await pool.query(`
    SELECT m.id, m.status, m.created_at,
      c.first_name AS creator_name,
      j.first_name AS joiner_name
    FROM matches m
    JOIN users c ON m.creator_id = c.id
    LEFT JOIN users j ON m.joiner_id = j.id
    WHERE (m.creator_id = $1 OR m.joiner_id = $1)
      AND m.status != 'finished'
    ORDER BY m.updated_at DESC
    LIMIT 10
  `, [req.userId]);

  res.json({ matches: result.rows });
});

// POST /api/matches — create match
router.post('/', authMiddleware, async (req, res) => {
  const result = await pool.query(
    `INSERT INTO matches (creator_id) VALUES ($1) RETURNING *`,
    [req.userId]
  );
  res.json({ match: result.rows[0] });
});

// POST /api/matches/:id/join
router.post('/:id/join', authMiddleware, async (req, res) => {
  const matchId  = parseInt(req.params.id);
  const testMode = process.env.TEST_MODE === 'true';

  const match = await getMatchFull(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.status !== 'waiting_for_joiner') {
    return res.status(400).json({ error: 'Match is not open for joining' });
  }
  if (!testMode && match.creator_id === req.userId) {
    return res.status(400).json({ error: 'You cannot join your own match' });
  }
  if (!match.creator_hand_set) {
    return res.status(400).json({ error: "Host hasn't locked their hand yet — try again in a moment" });
  }

  const result = await pool.query(`
    UPDATE matches SET joiner_id = $1, status = 'joiner_guessing', updated_at = NOW()
    WHERE id = $2 AND status = 'waiting_for_joiner'
    RETURNING *
  `, [req.userId, matchId]);

  if (result.rowCount === 0) {
    return res.status(400).json({ error: 'Match already taken' });
  }

  const joiner  = await getUser(req.userId);
  const updated = await getMatchFull(matchId);

  // Tell both players what happened; tell joiner it's their turn to guess
  await notifyMove(matchId, joiner.first_name || 'Opponent', updated.creator_telegram_id, updated.joiner_telegram_id);
  await notifyYourTurn(updated.joiner_telegram_id, matchId);

  res.json({ match: result.rows[0] });
});

// GET /api/matches/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const matchId = parseInt(req.params.id);
  const match   = await getMatchFull(matchId);

  if (!match) return res.status(404).json({ error: 'Match not found' });

  const isCreator = match.creator_id === req.userId;
  const isJoiner  = match.joiner_id  === req.userId;
  const testMode  = process.env.TEST_MODE === 'true';

  if (!isCreator && !isJoiner && !testMode) {
    return res.status(403).json({ error: 'Not your match' });
  }

  const myRole = isCreator ? 'creator' : 'joiner';

  // My hand
  const myHandRow = await pool.query(
    'SELECT layout FROM hands WHERE match_id = $1 AND player_id = $2',
    [matchId, req.userId]
  );

  // My guesses (whichever phase I'm guessing in)
  const myGuessRows = await pool.query(`
    SELECT attempt_number, guess, correct_positions, is_correct, created_at
    FROM guesses WHERE match_id = $1 AND player_id = $2
    ORDER BY attempt_number ASC
  `, [matchId, req.userId]);

  const attemptsUsed = myGuessRows.rows.length;

  // Result + opponent hand reveal when finished
  let result = null;
  let opponentLayout = null;
  if (match.status === 'finished') {
    const rr = await pool.query(
      'SELECT * FROM match_results WHERE match_id = $1',
      [matchId]
    );
    result = rr.rows[0] || null;

    const opponentId = isCreator ? match.joiner_id : match.creator_id;
    if (opponentId) {
      const oh = await pool.query(
        'SELECT layout FROM hands WHERE match_id = $1 AND player_id = $2',
        [matchId, opponentId]
      );
      opponentLayout = oh.rows[0]?.layout || null;
    }
  }

  res.json({
    match: {
      id:              match.id,
      status:          match.status,
      myRole,
      creatorName:     match.creator_name || 'Creator',
      joinerName:      match.joiner_name  || null,
      creatorHandSet:  match.creator_hand_set,
      joinerHandSet:   match.joiner_hand_set,
      testMode,
    },
    myHand:       myHandRow.rows[0]?.layout || null,
    guesses:      myGuessRows.rows,
    attemptsUsed,
    attemptsLeft: MAX_GUESSES - attemptsUsed,
    result,
    opponentLayout,
  });
});

// POST /api/matches/:id/hand
// Creator sets hand during waiting_for_joiner
// Joiner  sets hand during joiner_setting_hand
router.post('/:id/hand', authMiddleware, async (req, res) => {
  const matchId = parseInt(req.params.id);
  const { layout } = req.body;

  if (!validateLayout(layout)) {
    return res.status(400).json({ error: 'Invalid layout — must use all 5 animals exactly once' });
  }

  const match = await getMatchFull(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const isCreator = match.creator_id === req.userId;
  const isJoiner  = match.joiner_id  === req.userId;

  if (!isCreator && !isJoiner) {
    return res.status(403).json({ error: 'Not your match' });
  }

  // Phase check
  if (isCreator && match.status !== 'waiting_for_joiner') {
    return res.status(400).json({ error: 'You can only set your hand before the match starts' });
  }
  if (isJoiner && match.status !== 'joiner_setting_hand') {
    return res.status(400).json({ error: 'Not the right time to set your hand' });
  }

  // Already set?
  const alreadySet = isCreator ? match.creator_hand_set : match.joiner_hand_set;
  if (alreadySet) return res.status(400).json({ error: 'Hand already set' });

  // Save hand
  await pool.query(`
    INSERT INTO hands (match_id, player_id, layout) VALUES ($1, $2, $3)
    ON CONFLICT (match_id, player_id) DO UPDATE SET layout = EXCLUDED.layout
  `, [matchId, req.userId, JSON.stringify(layout)]);

  let newStatus;

  if (isCreator) {
    // Mark hand set; status stays waiting_for_joiner
    await pool.query(
      `UPDATE matches SET creator_hand_set = TRUE, updated_at = NOW() WHERE id = $1`,
      [matchId]
    );
    newStatus = 'waiting_for_joiner';
  } else {
    // Joiner locked hand → creator's turn to guess
    await pool.query(
      `UPDATE matches SET joiner_hand_set = TRUE, status = 'creator_guessing', updated_at = NOW() WHERE id = $1`,
      [matchId]
    );
    newStatus = 'creator_guessing';

    const updated = await getMatchFull(matchId);
    const actor   = await getUser(req.userId);
    await notifyMove(matchId, actor.first_name || 'Player', updated.creator_telegram_id, updated.joiner_telegram_id);
    await notifyYourTurn(updated.creator_telegram_id, matchId);
  }

  res.json({ ok: true, status: newStatus });
});

// POST /api/matches/:id/guess
// Joiner  guesses during joiner_guessing
// Creator guesses during creator_guessing
router.post('/:id/guess', authMiddleware, async (req, res) => {
  const matchId = parseInt(req.params.id);
  const { guess } = req.body;

  if (!validateLayout(guess)) {
    return res.status(400).json({ error: 'Invalid guess — must use all 5 animals exactly once' });
  }

  const match = await getMatchFull(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const isCreator = match.creator_id === req.userId;
  const isJoiner  = match.joiner_id  === req.userId;

  if (!isCreator && !isJoiner) return res.status(403).json({ error: 'Not your match' });

  // Phase check — only the active guesser can submit
  if (isJoiner  && match.status !== 'joiner_guessing')  {
    return res.status(400).json({ error: 'Not your turn to guess' });
  }
  if (isCreator && match.status !== 'creator_guessing') {
    return res.status(400).json({ error: 'Not your turn to guess' });
  }

  // Count attempts
  const attemptsResult = await pool.query(
    'SELECT COUNT(*) AS count FROM guesses WHERE match_id = $1 AND player_id = $2',
    [matchId, req.userId]
  );
  const attemptsUsed = parseInt(attemptsResult.rows[0].count);
  if (attemptsUsed >= MAX_GUESSES) {
    return res.status(400).json({ error: 'No attempts remaining' });
  }

  // Get the hand being guessed (the OTHER player's hand)
  const opponentId = isCreator ? match.joiner_id : match.creator_id;
  const opHand = await pool.query(
    'SELECT layout FROM hands WHERE match_id = $1 AND player_id = $2',
    [matchId, opponentId]
  );
  if (!opHand.rows[0]) {
    return res.status(400).json({ error: 'Opponent has not set their hand yet' });
  }

  const secretLayout     = opHand.rows[0].layout;
  const correctPositions = countCorrectPositions(guess, secretLayout);
  const isCorrect        = correctPositions === 5;
  const attemptNumber    = attemptsUsed + 1;
  const playerDone       = isCorrect || attemptNumber >= MAX_GUESSES;

  // Save guess
  await pool.query(`
    INSERT INTO guesses (match_id, player_id, attempt_number, guess, correct_positions, is_correct)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [matchId, req.userId, attemptNumber, JSON.stringify(guess), correctPositions, isCorrect]);

  let newStatus = match.status;
  let finalResult = null;

  if (playerDone) {
    if (isJoiner) {
      // Joiner done guessing → joiner must now set their own hand
      await pool.query(
        `UPDATE matches SET status = 'joiner_setting_hand', joiner_finished = TRUE, updated_at = NOW() WHERE id = $1`,
        [matchId]
      );
      newStatus = 'joiner_setting_hand';

      const updated = await getMatchFull(matchId);
      const actor   = await getUser(req.userId);
      await notifyMove(matchId, actor.first_name || 'Player', updated.creator_telegram_id, updated.joiner_telegram_id);
      await notifyYourTurn(updated.joiner_telegram_id, matchId); // joiner's turn to set hand

    } else {
      // Creator done guessing → match finished
      await pool.query(
        `UPDATE matches SET status = 'finished', creator_finished = TRUE, updated_at = NOW() WHERE id = $1`,
        [matchId]
      );
      newStatus = 'finished';

      // Compute results
      const joinerGuessFin = await pool.query(`
        SELECT attempt_number, is_correct FROM guesses
        WHERE match_id = $1 AND player_id = $2 ORDER BY attempt_number DESC LIMIT 1
      `, [matchId, match.joiner_id]);

      const joinerAttempts   = joinerGuessFin.rows[0]?.attempt_number || MAX_GUESSES;
      const joinerGuessed    = joinerGuessFin.rows[0]?.is_correct     || false;
      const joinerGuessScore = joinerGuessed ? calculateGuessScore(joinerAttempts) : 0;

      const creatorAttempts   = attemptNumber;
      const creatorGuessed    = isCorrect;
      const creatorGuessScore = creatorGuessed ? calculateGuessScore(creatorAttempts) : 0;

      const outcome = determineWinner(
        { guessed: creatorGuessed, guessScore: creatorGuessScore },
        { guessed: joinerGuessed,  guessScore: joinerGuessScore  }
      );

      const winnerId = outcome.winner === 'creator' ? match.creator_id
                     : outcome.winner === 'joiner'  ? match.joiner_id
                     : null;

      await pool.query(`
        INSERT INTO match_results
          (match_id, winner_id, is_draw,
           creator_attempts, joiner_attempts,
           creator_guess_score, joiner_guess_score,
           creator_match_points, joiner_match_points)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [matchId, winnerId, outcome.winner === null,
          creatorAttempts, joinerAttempts,
          creatorGuessScore, joinerGuessScore,
          outcome.creatorPoints, outcome.joinerPoints]);

      finalResult = {
        winnerId,
        isDraw:            outcome.winner === null,
        creatorAttempts,   joinerAttempts,
        creatorGuessScore, joinerGuessScore,
        creatorMatchPoints: outcome.creatorPoints,
        joinerMatchPoints:  outcome.joinerPoints,
      };

      const updated = await getMatchFull(matchId);
      await notifyFinished(
        matchId,
        updated.creator_name || 'Creator',
        updated.joiner_name  || 'Joiner',
        { winner: outcome.winner, ...finalResult },
        updated.creator_telegram_id,
        updated.joiner_telegram_id
      );
    }
  } else {
    // Not done yet — just notify move
    const updated = await getMatchFull(matchId);
    const actor   = await getUser(req.userId);
    await notifyMove(matchId, actor.first_name || 'Player', updated.creator_telegram_id, updated.joiner_telegram_id);
  }

  res.json({
    correctPositions,
    isCorrect,
    attemptsUsed:  attemptNumber,
    attemptsLeft:  MAX_GUESSES - attemptNumber,
    playerDone,
    newStatus,
    result: finalResult,
  });
});

export default router;
