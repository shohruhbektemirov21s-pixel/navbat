import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Mail, User, Phone, AlertCircle, Send, CheckCircle2, ArrowLeft, ExternalLink, Loader2, Copy, Check, Smartphone } from 'lucide-react';
import { api, setStoredToken, refreshFrom } from '../api';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { User as UserType } from '../types';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { useTranslation } from '../i18n/LanguageContext';
import { NavbatBorLogo } from './NavbatBorLogo';
import { makePhoneChangeHandler, phoneKeyDownGuard } from '../utils/phoneInput';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: UserType) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('+998');

  const [loading, setLoading] = useState<boolean>(false);
  const [tgLoading, setTgLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Telegram Quick Login state
  const [showTgView, setShowTgView] = useState<boolean>(false);
  const [tgSession, setTgSession] = useState<{
    sessionId: string;
    code: string;
    botUsername: string;
    botUrl: string;
    deepLink: string;
    tgDirect: string;
  } | null>(null);
  const [tgPhone, setTgPhone] = useState<string>('+998');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<'IDLE' | 'WAITING' | 'CONFIRMED' | 'TIMEOUT'>('IDLE');
  const [countdown, setCountdown] = useState<number>(90);
  const pollTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

  const { isTMA, tgUser, initData, hapticFeedback } = useTelegramWebApp();
  useEscapeKey(onClose);

  // Delayed onSuccess calls must not fire after the modal is unmounted.
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up polling and countdown timers on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // 1-Click Native Login inside Telegram WebApp
  const handleTelegramMiniAppLogin = async () => {
    if (!tgUser) return;
    setTgLoading(true);
    setError(null);
    hapticFeedback.impact('medium');

    try {
      const res = await api.loginWithTelegramWebApp({
        initData,
        user: tgUser,
      });
      setStoredToken(res.token, refreshFrom(res));
      hapticFeedback.notification('success');
      onSuccess(res.user);
    } catch (err: any) {
      hapticFeedback.notification('error');
      setError(err.message || 'Telegram error');
    } finally {
      setTgLoading(false);
    }
  };

  // Start Telegram Browser Quick Login session
  const startTelegramBrowserLogin = async () => {
    setTgLoading(true);
    setError(null);
    setShowTgView(true);
    setVerificationStatus('WAITING');
    setCountdown(90);

    try {
      const session = await api.createTelegramAuthSession();
      setTgSession(session);

      // Start countdown
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setVerificationStatus('TIMEOUT');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start polling
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await api.checkTelegramAuthSession(session.sessionId);
          if (res.status === 'CONFIRMED' && res.token && res.user) {
            clearInterval(pollTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            setVerificationStatus('CONFIRMED');
            setStoredToken(res.token, refreshFrom(res));
            hapticFeedback.notification('success');
            const user = res.user;
            successTimerRef.current = setTimeout(() => onSuccess(user), 800);
          } else if (res.status === 'EXPIRED') {
            clearInterval(pollTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            setVerificationStatus('TIMEOUT');
          }
        } catch (e) {
          // ignore transient poll error
        }
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Telegram sessiyasini yaratishda xatolik');
      setVerificationStatus('TIMEOUT');
    } finally {
      setTgLoading(false);
    }
  };

  // Open real Telegram bot safely across platforms
  const handleOpenTelegramBot = () => {
    if (!tgSession) return;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      // Try native tg:// protocol first, with fallback to web link
      window.location.href = tgSession.tgDirect;
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = tgSession.deepLink;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 700);
    } else {
      const link = document.createElement('a');
      link.href = tgSession.deepLink;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Instant login via Telegram phone or 1-click verify
  const handleQuickTelegramSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTgLoading(true);
    setError(null);

    try {
      // "+998" placeholder alone is not a phone number — don't send it.
      const hasPhone = tgPhone.replace(/\D/g, '').length > 3;
      const res = await api.quickTelegramLogin({
        phone: hasPhone ? tgPhone.trim() : undefined,
        sessionId: tgSession?.sessionId,
        code: tgSession?.code,
      });

      if (res.success && res.token) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setVerificationStatus('CONFIRMED');
        setStoredToken(res.token, refreshFrom(res));
        hapticFeedback.notification('success');
        successTimerRef.current = setTimeout(() => onSuccess(res.user), 500);
      } else {
        setError(res.message || 'Telegram botda tasdiqlash hali yakunlanmagan. Botda /start ni bosing va qayta urinib ko‘ring.');
      }
    } catch (err: any) {
      setError(err.message || 'Kirishda xatolik yuz berdi');
    } finally {
      setTgLoading(false);
    }
  };

  // Standard Email/Password Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login({ email: email.trim(), password });
        setStoredToken(res.token ?? null, refreshFrom(res));
        onSuccess(res.user);
      } else {
        // Role is decided by the backend (always CUSTOMER for self-registration).
        const res = await api.register({
          email: email.trim(),
          password,
          name: name.trim(),
          phone: phone.trim(),
        });
        setStoredToken(res.token ?? null, refreshFrom(res));
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!tgSession?.code) return;
    navigator.clipboard?.writeText(tgSession.code).catch(() => {});
    setCopiedCode(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={showTgView ? 'Telegram orqali tasdiqlash' : mode === 'login' ? 'Tizimga kirish' : 'Ro‘yxatdan o‘tish'}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        <button
          id="close-auth-modal-btn"
          aria-label="Yopish"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TELEGRAM QUICK LOGIN VIEW */}
        {showTgView ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setShowTgView(false);
                  if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                  if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                }}
                className="p-1.5 -ml-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Orqaga"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#2AABEE] flex items-center justify-center text-white shadow-xs">
                  <Send className="w-3.5 h-3.5 fill-white -translate-x-0.2" />
                </div>
                <h3 className="text-base font-bold text-slate-900">TELEGRAM ORQALI TASDIQLASH</h3>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Telegram Bot Action Card */}
            <div className="bg-gradient-to-br from-sky-50 via-sky-50/70 to-blue-50/60 border border-sky-200 rounded-2xl p-4.5 mb-4 text-center">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-sky-100 flex items-center justify-center mx-auto mb-3 text-[#2AABEE]">
                <Send className="w-7 h-7 fill-[#2AABEE]" />
              </div>

              <h4 className="text-sm font-bold text-slate-900 mb-1">
                Telegram botingiz orqali tasdiqlang
              </h4>
              <p className="text-xs text-slate-600 mb-3.5">
                Pastdagi tugmani bosing va botda <b>/start</b> tugmasini bosing
              </p>

              {tgSession && (
                <div className="flex flex-col items-center gap-1.5 mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-sky-200 rounded-xl shadow-xs">
                    <span className="text-xs text-slate-500 font-medium">Tasdiqlash kodi:</span>
                    <span className="font-mono font-black text-base text-sky-700 tracking-wider">{tgSession.code}</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-1 text-slate-400 hover:text-sky-600 transition cursor-pointer"
                      title="Nusxalash"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {tgSession.botUsername && (
                    <span className="text-[11px] text-slate-400">
                      Bot: <span className="font-semibold text-slate-600">@{tgSession.botUsername}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Step 1: Open Telegram Bot Primary Button */}
              {tgSession && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleOpenTelegramBot}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-[#2AABEE] to-[#229ED9] hover:from-[#229ED9] hover:to-[#1a89bf] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Send className="w-4 h-4 fill-white" />
                    <span>Telegram Botni ochish</span>
                    <ExternalLink className="w-4 h-4 opacity-80" />
                  </button>

                  <a
                    href={tgSession.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-600 hover:text-sky-800 font-medium underline py-1"
                  >
                    Telegram Web yoki brauzerda ochish
                  </a>
                </div>
              )}

              {/* Status State Indicator */}
              <div className="mt-4 pt-3.5 border-t border-sky-100 flex items-center justify-center gap-2">
                {verificationStatus === 'CONFIRMED' ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Tasdiqlandi ✓ Kirilmoqda...</span>
                  </div>
                ) : verificationStatus === 'TIMEOUT' ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Kod muddati tugadi</span>
                    </div>
                    <button
                      type="button"
                      onClick={startTelegramBrowserLogin}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      🔄 Qayta urinish
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
                    <span>Telegram orqali tasdiqlash kutilmoqda... ({countdown}s)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: 1-Click Fast Confirm / Fallback */}
            <div className="space-y-2 mb-3">
              <button
                type="button"
                id="tg-one-click-confirm-btn"
                onClick={() => handleQuickTelegramSubmit()}
                disabled={tgLoading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {tgLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>TASDIQLASH / 1 BOSISHDA TASDIQLASH</span>
              </button>

              {/* Phone login option */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70">
                <span className="block text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  Yoki telefon raqamingiz orqali tasdiqlang:
                </span>
                <form onSubmit={handleQuickTelegramSubmit} className="flex gap-2">
                  <input
                    type="tel"
                    id="tg-quick-phone-input"
                    value={tgPhone}
                    onChange={makePhoneChangeHandler(setTgPhone)}
                    onKeyDown={phoneKeyDownGuard}
                    placeholder="+998 90 123 45 67"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={tgLoading}
                    className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    Kirish
                  </button>
                </form>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowTgView(false);
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-medium py-1.5 cursor-pointer"
            >
              Email va parol orqali kirishga qaytish
            </button>
          </div>
        ) : (
          /* STANDARD LOGIN / REGISTRATION VIEW */
          <div>
            <div className="text-center mb-5">
              <NavbatBorLogo variant="emblem-card" size="md" className="mx-auto mb-3" />
              <h3 className="text-xl font-black text-slate-900">
                {mode === 'login' ? 'Tizimga kirish' : 'Ro‘yxatdan o‘tish'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {mode === 'login'
                  ? 'NavbatBor hisobingizga kiring va navbatlaringizni boshqaring'
                  : 'Yangi hisob oching va klinika hamda xizmatlarga oson navbat oling'}
              </p>
            </div>

            {/* PRIMARY CTA: TELEGRAM QUICK LOGIN */}
            <div className="mb-4">
              {isTMA && tgUser ? (
                <button
                  type="button"
                  id="tg-tma-login-btn"
                  onClick={handleTelegramMiniAppLogin}
                  disabled={tgLoading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#2AABEE] to-[#229ED9] hover:from-[#229ED9] hover:to-[#1a89bf] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-md transition active:scale-[0.98] cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-white" />
                  <span>
                    {tgLoading
                      ? 'Yuklanmoqda...'
                      : `TELEGRAM ORQALI KIRISH (${tgUser.first_name})`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  id="tg-web-login-btn"
                  onClick={startTelegramBrowserLogin}
                  disabled={tgLoading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#2AABEE] to-[#229ED9] hover:from-[#229ED9] hover:to-[#1a89bf] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-white" />
                  <span>TELEGRAM ORQALI TEZKOR KIRISH</span>
                </button>
              )}

              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[11px] text-slate-400 font-medium uppercase">Yoki Email bilan</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">{t('full_name')}</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        id="auth-name-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alisher Zokirov"
                        required
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">{t('phone_number')}</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="tel"
                        id="auth-phone-input"
                        value={phone}
                        onChange={makePhoneChangeHandler(setPhone)}
                        onKeyDown={phoneKeyDownGuard}
                        required
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('email')}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    id="auth-email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@mail.uz"
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">{t('password')}</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    id="auth-password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="******"
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="auth-submit-btn"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-xs mt-4 cursor-pointer disabled:opacity-50"
              >
                {loading ? t('loading') : mode === 'login' ? t('login') : t('register')}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-slate-500">
              {mode === 'login' ? (
                <span>
                  {t('no_account_prompt')}{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    {t('register')}
                  </button>
                </span>
              ) : (
                <span>
                  {t('have_account_prompt')}{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    {t('login')}
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
