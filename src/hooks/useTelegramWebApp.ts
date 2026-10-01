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
  /**
   * Shows the native Telegram BackButton and wires `onClick` to it.
   * Returns a cleanup that detaches the handler and hides the button.
   * No-op outside the Telegram WebApp (or on clients older than Bot API 6.1).
   */
  showBackButton: (onClick: () => void) => () => void;
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

  const showBackButton = useCallback((onClick: () => void) => {
    const tg = window.Telegram?.WebApp;
    const backButton = tg?.BackButton;
    const supported =
      !!backButton && (typeof tg.isVersionAtLeast !== 'function' || tg.isVersionAtLeast('6.1'));
    if (!supported || !(tg.initData || tg.initDataUnsafe?.user)) {
      return () => {};
    }
    try {
      backButton.onClick(onClick);
      backButton.show();
    } catch (e) {
      // ignore
    }
    return () => {
      try {
        backButton.offClick(onClick);
        backButton.hide();
      } catch (e) {
        // ignore
      }
    };
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
    showBackButton,
  };
}
