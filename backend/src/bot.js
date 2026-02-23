import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'https://zooclash.meerkscan.com';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

export const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    '🐾 Welcome to ZooClash!\nArrange your secret zoo card hand and challenge opponents.',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 Open ZooClash', web_app: { url: APP_URL } }
        ]]
      }
    }
  );
});

export async function sendBotMessage(telegramId, text) {
  try {
    await bot.telegram.sendMessage(telegramId, text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error(`Bot message failed to ${telegramId}:`, err.message);
  }
}

export async function notifyMove(matchId, actorName, creatorTelegramId, joinerTelegramId) {
  const text = `🐾 Match #${matchId}: <b>${actorName}</b> made a move.`;
  await sendBotMessage(creatorTelegramId, text);
  if (joinerTelegramId && joinerTelegramId !== creatorTelegramId) {
    await sendBotMessage(joinerTelegramId, text);
  }
}

export async function notifyYourTurn(telegramId, matchId) {
  await sendBotMessage(
    telegramId,
    `⏳ Match #${matchId}: It's your turn now! Open ZooClash: ${APP_URL}`
  );
}

export async function notifyFinished(matchId, creatorName, joinerName, result, creatorTelegramId, joinerTelegramId) {
  const winnerText = result.winner === 'creator'
    ? `🏆 Winner: ${creatorName}`
    : result.winner === 'joiner'
    ? `🏆 Winner: ${joinerName}`
    : '🤝 Draw!';

  const text =
    `🏁 Match #${matchId} finished!\n` +
    `${creatorName}: GuessScore ${result.creatorGuessScore}, MatchPoints ${result.creatorMatchPoints}\n` +
    `${joinerName}: GuessScore ${result.joinerGuessScore}, MatchPoints ${result.joinerMatchPoints}\n` +
    winnerText;

  await sendBotMessage(creatorTelegramId, text);
  if (joinerTelegramId && joinerTelegramId !== creatorTelegramId) {
    await sendBotMessage(joinerTelegramId, text);
  }
}

export async function setupWebhook() {
  if (WEBHOOK_URL) {
    const webhookPath = `/webhook/${BOT_TOKEN}`;
    await bot.telegram.setWebhook(`${WEBHOOK_URL}${webhookPath}`);
    console.log(`Bot webhook set to: ${WEBHOOK_URL}${webhookPath}`);
    return webhookPath;
  }
  return null;
}
