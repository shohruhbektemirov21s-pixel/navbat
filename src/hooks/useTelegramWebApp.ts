import { useState, useEffect, useCallback } from 'react';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface UseTelegramWebAppReturn {
  isTMA: boolean;
  tgUser: TelegramUser | null;
  initData: string;
  themeParams: any;
  colorScheme: 'light' | 'dark';
  hapticFeedback: {
    impact: (style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notification: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  openTelegramLink: (url: string) => void;
  closeApp: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export function useTelegramWebApp(): UseTelegramWebAppReturn {
  const [isTMA, setIsTMA] = useState<boolean>(false);
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string>('');
  const [themeParams, setThemeParams] = useState<any>({});
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && (tg.initData || tg.initDataUnsafe?.user)) {
      setIsTMA(true);
      try {
        tg.ready();
        tg.expand();
      } catch (e) {
        // ignore
      }

      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user);
      }
      if (tg.initData) {
        setInitData(tg.initData);
      }
      if (tg.themeParams) {
        setThemeParams(tg.themeParams);
      }
      if (tg.colorScheme) {
        setColorScheme(tg.colorScheme);
      }
    }
  }, []);

  const impact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred(style);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const notification = useCallback((type: 'error' | 'success' | 'warning') => {
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.notificationOccurred(type);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const selectionChanged = useCallback(() => {
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.selectionChanged();
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const openTelegramLink = useCallback((url: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, []);

  const closeApp = useCallback(() => {
    const tg = window.Telegram?.WebApp;
    if (tg?.close) {
      tg.close();
    }
  }, []);

  return {
    isTMA,
    tgUser,
    initData,
    themeParams,
    colorScheme,
    hapticFeedback: {
      impact,
      notification,
      selectionChanged,
    },
    openTelegramLink,
    closeApp,
  };
}
