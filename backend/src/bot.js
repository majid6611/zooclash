import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'https://zooclash.meerkscan.com';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

export const bot = new Telegraf(BOT_TOKEN);

function buildMatchUrl(matchId) {
  if (!matchId) return APP_URL;
  try {
    const url = new URL(APP_URL);
    url.searchParams.set('match', String(matchId));
    return url.toString();
  } catch {
    const separator = APP_URL.includes('?') ? '&' : '?';
    return `${APP_URL}${separator}match=${encodeURIComponent(matchId)}`;
  }
}

function buildOpenMatchButton(matchId, text = '🎮 Open Match') {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text, web_app: { url: buildMatchUrl(matchId) } }
      ]]
    }
  };
}

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

export async function sendBotMessage(telegramId, text, extra = {}) {
  if (!telegramId) return;
  try {
    await bot.telegram.sendMessage(telegramId, text, { parse_mode: 'HTML', ...extra });
  } catch (err) {
    console.error(`Bot message failed to ${telegramId}:`, err.message);
  }
}

export async function notifyPlayerJoined(matchId, joinerName, creatorTelegramId) {
  await sendBotMessage(
    creatorTelegramId,
    `🐾 Match #${matchId}: <b>${joinerName}</b> joined your match!`,
    buildOpenMatchButton(matchId)
  );
}

export async function notifyYourTurn(telegramId, matchId) {
  await sendBotMessage(
    telegramId,
    `⏳ Match #${matchId}: It's your turn now!`,
    buildOpenMatchButton(matchId, '🎯 Play Your Turn')
  );
}

export async function notifyHandSwitched(matchId, telegramId) {
  await sendBotMessage(
    telegramId,
    `🔄 Match #${matchId}: Opponent set their hand. It's your turn now!`,
    buildOpenMatchButton(matchId, '🎯 Play Your Turn')
  );
}

export async function sendMatchInvite(matchId, creatorTelegramId, creatorName) {
  await sendBotMessage(
    creatorTelegramId,
    `🎮 <b>${creatorName}</b> is looking for an opponent!\n\nJoin <b>Match #${matchId}</b> and try to guess the secret animal order. Can you beat them?`,
    buildOpenMatchButton(matchId, '🐾 Join the Match')
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

  await sendBotMessage(creatorTelegramId, text, buildOpenMatchButton(matchId, '📊 View Result'));
  if (joinerTelegramId && joinerTelegramId !== creatorTelegramId) {
    await sendBotMessage(joinerTelegramId, text, buildOpenMatchButton(matchId, '📊 View Result'));
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
