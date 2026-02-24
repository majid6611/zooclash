import { pool } from './db.js';

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      avatar INTEGER DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar INTEGER DEFAULT NULL;

    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'waiting_for_joiner',
      creator_id INTEGER REFERENCES users(id),
      joiner_id INTEGER REFERENCES users(id),
      creator_hand_set BOOLEAN DEFAULT FALSE,
      joiner_hand_set BOOLEAN DEFAULT FALSE,
      creator_finished BOOLEAN DEFAULT FALSE,
      joiner_finished BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS hands (
      id SERIAL PRIMARY KEY,
      match_id INTEGER REFERENCES matches(id),
      player_id INTEGER REFERENCES users(id),
      layout JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(match_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS guesses (
      id SERIAL PRIMARY KEY,
      match_id INTEGER REFERENCES matches(id),
      player_id INTEGER REFERENCES users(id),
      attempt_number INTEGER NOT NULL,
      guess JSONB NOT NULL,
      correct_positions INTEGER NOT NULL,
      is_correct BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS animals JSONB;

    CREATE TABLE IF NOT EXISTS match_invites (
      id SERIAL PRIMARY KEY,
      match_id   INTEGER REFERENCES matches(id),
      inviter_id INTEGER REFERENCES users(id),
      invitee_id INTEGER REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS match_results (
      id SERIAL PRIMARY KEY,
      match_id INTEGER REFERENCES matches(id) UNIQUE,
      winner_id INTEGER REFERENCES users(id),
      is_draw BOOLEAN DEFAULT FALSE,
      creator_attempts INTEGER,
      joiner_attempts INTEGER,
      creator_guess_score INTEGER,
      joiner_guess_score INTEGER,
      creator_match_points INTEGER,
      joiner_match_points INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('Migrations complete');
}
