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
