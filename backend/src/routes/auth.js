import { Router } from 'express';
import { pool } from '../db.js';
import { validateTelegramInitData, createToken } from '../auth.js';

const router = Router();

router.post('/', async (req, res) => {
  const { initData, testUser } = req.body;

  let telegramUser;

  if (process.env.TEST_MODE === 'true' && testUser) {
    console.warn('[TEST MODE] Bypassing Telegram auth for:', testUser.id);
    telegramUser = testUser;
  } else {
    telegramUser = validateTelegramInitData(initData);
    if (!telegramUser) {
      return res.status(401).json({ error: 'Invalid Telegram init data' });
    }
  }

  const { id: telegramId, username, first_name } = telegramUser;

  const result = await pool.query(`
    INSERT INTO users (telegram_id, username, first_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name
    RETURNING *
  `, [telegramId, username || null, first_name || 'Player']);

  const user = result.rows[0];
  const token = createToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      telegramId: String(user.telegram_id),
      name: user.first_name || user.username || 'Player',
    },
  });
});

export default router;
