export const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return null;
};

export const getTelegramInitData = () => {
  const webApp = getTelegramWebApp();
  if (webApp?.initData && webApp.initData.trim() !== '') {
    return webApp.initData;
  }
  if (typeof window !== 'undefined') {
    // 1. Check window.location.hash for tgWebAppData
    const hash = window.location.hash;
    if (hash && hash.includes('tgWebAppData=')) {
      const match = hash.match(/tgWebAppData=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    // 2. Check window.location.search for tgWebAppData
    const search = window.location.search;
    if (search && search.includes('tgWebAppData=')) {
      const match = search.match(/tgWebAppData=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
  }
  return "";
};

export const getTelegramUser = () => {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user || null;
};

export const expandTelegramWebApp = () => {
  const webApp = getTelegramWebApp();
  webApp?.expand();
};

export const closeTelegramWebApp = () => {
  const webApp = getTelegramWebApp();
  webApp?.close();
};

export const showTelegramMainButton = (text: string, onClick: () => void) => {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.MainButton.text = text;
    webApp.MainButton.onClick(onClick);
    webApp.MainButton.show();
  }
};

export const hideTelegramMainButton = () => {
  const webApp = getTelegramWebApp();
  webApp?.MainButton.hide();
};
