import React from 'react';
import { X, ShieldCheck, FileText, HelpCircle } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface LegalModalProps {
  type: 'privacy' | 'terms' | 'support';
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  useEscapeKey(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 max-h-[85vh] overflow-y-auto">
        <button aria-label="Yopish"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {type === 'privacy' && (
          <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-base">
              <ShieldCheck className="w-5 h-5" />
              <span>Maxfiylik Siyosati (Privacy Policy)</span>
            </div>
            <p>
              NavbatBor platformasi foydalanuvchilarning shaxsiy ma’lumotlari xavfsizligini ta’minlashni o‘zining oliy maqsadi deb biladi.
            </p>
            <h4 className="font-bold text-slate-800 text-sm">1. To‘planadigan ma’lumotlar</h4>
            <p>
              Bronlash va elektron navbat tizimidan foydalanganda mijozning ismi, telefon raqami va tanlangan xizmat ma’lumotlari qayta ishlanadi.
            </p>
            <h4 className="font-bold text-slate-800 text-sm">2. Ma’lumotlar xavfsizligi</h4>
            <p>
              Barcha aloqa shifrlangan SSL protokollari orqali amalga oshiriladi va uchinchi tomonlarga ruxsatsiz berilmaydi.
            </p>
          </div>
        )}

        {type === 'terms' && (
          <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-base">
              <FileText className="w-5 h-5" />
              <span>Foydalanish Shartlari (Terms of Service)</span>
            </div>
            <p>
              NavbatBor xizmatlaridan foydalanish orqali siz quyidagi qoidalarga to‘liq rozilik bildirasiz:
            </p>
            <h4 className="font-bold text-slate-800 text-sm">1. Bron qilish qoidalari</h4>
            <p>
              Mijoz belgilangan vaqtdan kamida 10 daqiqa oldin xizmat ko‘rsatish joyiga yetib kelishi tavsiya etiladi.
              Agar mijoz kela olmasa, kamida 1 soat oldin bronni bekor qilishi yoki boshqa vaqtga ko‘chirishi shart.
            </p>
            <h4 className="font-bold text-slate-800 text-sm">2. Elektron navbat</h4>
            <p>
              Chaqiruv paytida hozir bo‘lmagan mijozning navbati navbatdagi navbatchilarga o‘tkazib yuborilishi mumkin.
            </p>
          </div>
        )}

        {type === 'support' && (
          <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-base">
              <HelpCircle className="w-5 h-5" />
              <span>Qo‘llab-quvvatlash Xizmati (Support 24/7)</span>
            </div>
            <p>
              Platformadan foydalanishda yoki biznesingizni ulashda savollar yuzaga kelsa, bizning mutaxassislarimiz yordamga tayyor:
            </p>
            <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200">
              <div><strong>Ish vaqti:</strong> Dushanba - Shanba: 09:00 - 20:00</div>
              <div><strong>Telefon:</strong> +998 (71) 200-00-11</div>
              <div><strong>Telegram bot:</strong> @NavbatBorSupportBot</div>
              <div><strong>Email:</strong> support@navbatbor.uz</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
