import React, { useState } from 'react';
import { X, Users, Clock, AlertCircle, CheckCircle, Send, Share2, Check, Bell } from 'lucide-react';
import { api } from '../api';
import { Service, User as UserType } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface QueueModalProps {
  business: any;
  services: Service[];
  currentUser: UserType | null;
  onClose: () => void;
  onSuccess: (queueEntry: any) => void;
  onOpenAuth: () => void;
}

export const QueueModal: React.FC<QueueModalProps> = ({
  business,
  services,
  currentUser,
  onClose,
  onSuccess,
  onOpenAuth,
}) => {
  const { t } = useTranslation();
  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const initialTg = currentUser?.telegram_chat_id || (tgUser?.id ? String(tgUser.id) : '');

  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [name, setName] = useState<string>(currentUser?.name || tgUser?.first_name || '');
  const [phone, setPhone] = useState<string>(currentUser?.phone || '+998');
  const [telegramChatId, setTelegramChatId] = useState<string>(initialTg);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedTicket, setJoinedTicket] = useState<any | null>(null);
  const [sendingToTg, setSendingToTg] = useState<boolean>(false);
  const [tgSentMessage, setTgSentMessage] = useState<string | null>(null);
  const [customTgInput, setCustomTgInput] = useState<string>(initialTg);
  const [showTgInput, setShowTgInput] = useState<boolean>(false);

  const botUsername = 'Navbat1Uzb_bot';

  const handleSendTicketToTelegram = async () => {
    if (!joinedTicket) return;
    setSendingToTg(true);
    setTgSentMessage(null);
    try {
      const res = await api.sendQueueTicketToTelegram(joinedTicket.id, customTgInput || telegramChatId || currentUser?.telegram_chat_id);
      setTgSentMessage(res.message || 'Telegramga yuborildi!');
    } catch (err: any) {
      if (err.message && (err.message.includes('Chat ID') || err.message.includes('topilmadi'))) {
        setShowTgInput(true);
      }
      setTgSentMessage(err.message || 'Xatolik yuz berdi');
    } finally {
      setSendingToTg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (!name || !phone) {
      setError('Iltimos, ism va telefon raqamini kiriting');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.joinQueue({
        business_id: business.id,
        service_id: selectedServiceId,
        customer_name: name,
        customer_phone: phone,
        telegram_chat_id: telegramChatId.trim() || undefined,
      });

      setJoinedTicket(res);
      onSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  const tgBotLink = joinedTicket?.telegramLink || `https://t.me/${botUsername}?start=queue_${joinedTicket?.id || ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">{t('join_queue')}</h3>
            <p className="text-xs text-slate-500">{business.name}</p>
          </div>
          <button
            id="close-queue-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {joinedTicket ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Users className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-slate-900">{t('queue_ticket')}</h4>
              <p className="text-xs text-slate-500 mt-1">
                {t('your_turn_desc')}
              </p>
            </div>

            <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-6">
              <div className="text-4xl font-extrabold text-amber-900 font-mono tracking-wider">
                {joinedTicket.queue_number}
              </div>
              <div className="text-xs text-amber-700 font-medium mt-1">
                {t('live_queue')}: <span className="uppercase font-bold">{t('status_pending')}</span>
              </div>
            </div>

            {/* Telegram 1-Click Activation Card */}
            <div className="bg-gradient-to-br from-[#2AABEE]/15 via-blue-50 to-indigo-50 border border-[#2AABEE]/40 rounded-2xl p-4 text-left space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                <div className="w-6 h-6 rounded-lg bg-[#2AABEE] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Send className="w-3.5 h-3.5 fill-white" />
                </div>
                <span>Telegramda eslatmalar olish</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Navbatingizga <strong>1–2 kishi qolganda</strong> va <strong>navbatingiz kelganda</strong> Telegram botimiz sizga darhol bepul xabarnoma yuboradi.
              </p>

              <a
                href={tgBotLink}
                target="_blank"
                rel="noopener noreferrer"
                id="tg-activate-ticket-btn"
                className="w-full py-2.5 px-4 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-bold text-xs rounded-xl shadow-md shadow-[#2AABEE]/25 flex items-center justify-center gap-2 transition"
              >
                <Send className="w-3.5 h-3.5 fill-white" />
                <span>Telegram Botda Faollashtirish (1-bosishda)</span>
              </a>
            </div>

            {/* Additional Telegram Tools */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              {tgSentMessage && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 font-medium ${
                  tgSentMessage.toLowerCase().includes('error') || tgSentMessage.toLowerCase().includes('xatolik')
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{tgSentMessage}</span>
                </div>
              )}

              {showTgInput && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Telegram Chat ID (masalan: 123456789)"
                    value={customTgInput}
                    onChange={(e) => setCustomTgInput(e.target.value)}
                    className="flex-1 text-xs border border-slate-300 rounded-xl px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleSendTicketToTelegram}
                    disabled={sendingToTg}
                    className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Yuborish
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="send-queue-tg-btn"
                  onClick={handleSendTicketToTelegram}
                  disabled={sendingToTg}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 text-slate-500" />
                  <span>{sendingToTg ? t('loading') : 'Xabar yuborish'}</span>
                </button>

                <a
                  id="share-queue-tg-btn"
                  href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(
                    joinedTicket ? `🎟 "${business.name}" - NavbatBor navbat chiptasi: ${joinedTicket.queue_number}` : ''
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ulashish</span>
                </a>
              </div>
            </div>

            <button
              id="queue-done-btn"
              onClick={onClose}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase rounded-xl transition cursor-pointer"
            >
              {t('close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {t('services_title')}
              </label>
              <select
                id="queue-service-select"
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes} {t('minute_unit')}) — {Number(s.price_uzs).toLocaleString('uz-UZ')} UZS
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {t('full_name')}
              </label>
              <input
                type="text"
                id="queue-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {t('phone_number')}
              </label>
              <input
                type="tel"
                id="queue-phone-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Telegram notification notice or chat ID */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#0088cc] fill-[#0088cc]" />
                  <span>Telegram bildirishnomasi</span>
                </span>
                {telegramChatId ? (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">Ulangan</span>
                ) : (
                  <span className="text-[10px] text-slate-500">Ixtiyoriy</span>
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                Navbat kelganda va 1–2 kishi qolganda Telegram orqali xabardor qilamiz.
              </p>
              {!telegramChatId && (
                <input
                  type="text"
                  placeholder="Telegram Chat ID (agar bilsangiz)"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                />
              )}
            </div>

            {!business.is_open && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-1">
                <div className="text-xs font-bold text-rose-800">
                  Biznes hozir yopiq
                </div>
                <div className="text-[11px] text-rose-600">
                  Ish vaqti: {business.working_hours || '09:00–18:00'}. Navbat qabuli vaqtincha to‘xtatilgan.
                </div>
              </div>
            )}

            <button
              type="submit"
              id="confirm-queue-join-btn"
              disabled={submitting || !business.is_open}
              className={`w-full py-3 text-xs font-bold uppercase rounded-xl transition shadow-md ${
                !business.is_open
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20 cursor-pointer'
              }`}
            >
              {!business.is_open ? 'Biznes hozir yopiq' : submitting ? t('loading') : t('join_queue')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
