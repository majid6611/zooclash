import express from 'express';
import cors from 'cors';
import { runMigrations } from './migrations.js';
import { bot, setupWebhook } from './bot.js';
import authRoutes from './routes/auth.js';
import matchRoutes from './routes/matches.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await runMigrations();

  const webhookPath = await setupWebhook();
  if (webhookPath) {
    app.use(bot.webhookCallback(webhookPath));
    console.log('Bot running in webhook mode');
  } else {
    bot.launch();
    console.log('Bot running in polling mode');
  }

  app.listen(PORT, () => {
    console.log(`ZooClash backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
