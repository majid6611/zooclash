export const twa = window.Telegram?.WebApp;

export function getTelegramInitData() {
  return twa?.initData || '';
}

export function getTelegramUser() {
  return twa?.initDataUnsafe?.user || null;
}

export function expandApp() {
  twa?.expand();
}

export function haptic(type = 'light') {
  twa?.HapticFeedback?.impactOccurred(type);
}

export function shareMatch(matchId) {
  const tg = window.Telegram?.WebApp;

  // Preferred: inline query chat picker (requires inline mode enabled on bot)
  if (tg?.switchInlineQuery) {
    tg.switchInlineQuery(`match_${matchId}`, ['users', 'groups', 'channels']);
    return;
  }

  // Fallback: Telegram share URL (always works, shares a deep link)
  const matchUrl = `${window.location.origin}/?match=${matchId}`;
  const text     = `🎮 ZooClash Challenge! Join Match #${matchId} and guess my secret animal order 🐾`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(matchUrl)}&text=${encodeURIComponent(text)}`;

  if (tg?.openTelegramLink) {
    tg.openTelegramLink(shareUrl);
  } else {
    window.open(shareUrl, '_blank');
  }
}
