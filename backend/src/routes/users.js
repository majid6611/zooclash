import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

const AVATAR_COUNT = 10;

// PUT /api/users/avatar
router.put('/avatar', authMiddleware, async (req, res) => {
  const { avatar } = req.body;
  if (!Number.isInteger(avatar) || avatar < 1 || avatar > AVATAR_COUNT) {
    return res.status(400).json({ error: `Avatar must be a number between 1 and ${AVATAR_COUNT}` });
  }

  await pool.query(
    'UPDATE users SET avatar = $1 WHERE id = $2',
    [avatar, req.userId]
  );

  res.json({ ok: true, avatar });
});

export default router;
