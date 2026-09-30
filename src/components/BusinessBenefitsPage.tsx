import React from 'react';
import { 
  ArrowLeft, Building2, QrCode, Tv, Users, TrendingUp, 
  CheckCircle2, Sparkles, Send, ShieldCheck, ArrowRight 
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface BusinessBenefitsPageProps {
  onBack: () => void;
  onOpenOnboarding: () => void;
}

export const BusinessBenefitsPage: React.FC<BusinessBenefitsPageProps> = ({
  onBack,
  onOpenOnboarding,
}) => {
  const { t } = useTranslation();

  const businessFeatures = [
    {
      icon: QrCode,
      title: 'QR-kodli peshtaxta stendi',
      desc: 'Mijozlaringiz eshikdan kiriboq QR-kodni skanerlab telefonida darhol elektron chipta oladi. Qimmat terminal va qog‘oz printer talab qilinmaydi.',
      badge: '0 so‘m uskuna xarajati'
    },
    {
      icon: Tv,
      title: 'TV-ekran va jonli tablo',
      desc: 'Kutish zalidagi istalgan Smart-TV yoki planshetda chaqirilayotgan mijoz raqami va yoqimli ovozli bildirishnoma avtomatik yangilanadi.',
      badge: 'TV Tablo'
    },
    {
      icon: Users,
      title: 'Mutaxassislar va xodimlar boshqaruvi',
      desc: 'Har bir xodim o‘z kabineti yoki Telegram boti orqali keyingi mijozni chaqiradi, xizmat ko‘rsatadi va qabul statistikasini yuritadi.',
      badge: 'Operator kabineti'
    },
    {
      icon: TrendingUp,
      title: 'No-show (kelmaslik) holatini 70% ga kamaytirish',
      desc: 'Avtomatik Telegram va SMS eslatmalar sababli mijozlar bron qilingan vaqtini unutmaydi va vaqtida keladi.',
      badge: 'Mijozlar sadoqati'
    },
    {
      icon: Send,
      title: 'Telegram Bot bilan to‘liq integratsiya',
      desc: 'Biznes egasi har bir yangi navbat va bron haqida Telegramda lahzali xabarnoma oladi. Barcha ma’lumotlar sinxron ishlaydi.',
      badge: '24/7 Telegram'
    },
    {
      icon: ShieldCheck,
      title: 'Mijozlar bazasi (CRM) va tahlillar',
      desc: 'Qaysi xizmatlaringiz eng ko‘p talab qilinayotgani, mijozlar soni va umumiy tushumni qulay grafiklarda tahlil qiling.',
      badge: 'Analitika'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-600 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Bosh sahifaga qaytish</span>
          </button>
          <span className="text-xs font-semibold text-slate-400">NavbatBor Bizneslar uchun</span>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-xs font-semibold text-indigo-200">
            <Building2 className="w-3.5 h-3.5 text-indigo-300" />
            <span>Tadbirkorlar va muassasalar uchun</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Mijozlar oqimini tartibga soluvchi raqamli navbat tizimi
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto font-normal">
            Klinika, go‘zallik saloni, avtoservis yoki o‘quv markazingizda navbatlarni tartibga soling va xizmat sifatini oshiring.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={onOpenOnboarding}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-500/30 transition cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <span>Biznesingizni bepul qo‘shing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="https://t.me/Navbat1Uzb_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold rounded-xl border border-slate-700 transition flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4 text-[#2AABEE]" />
              <span>Operator Bot (@Navbat1Uzb_bot)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Grid of Business Features */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {businessFeatures.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-indigo-300 hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      {f.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* How It Works for Business */}
        <div className="mt-12 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-6 text-center">
            Qanday qilib 5 daqiqada ishga tushirish mumkin?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-2">
              <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-wider">1-QADAM</span>
              <h4 className="text-sm font-bold text-slate-900">Ro‘yxatdan o‘ting</h4>
              <p className="text-xs text-slate-500">Muassasa nomi, manzili va xizmatlar ro‘yxatini kiriting.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-2">
              <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-wider">2-QADAM</span>
              <h4 className="text-sm font-bold text-slate-900">QR-kodni chop eting</h4>
              <p className="text-xs text-slate-500">Tayyor PDF QR-stendni yuklab olib peshtaxtangizga qo‘ying.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-2">
              <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-wider">3-QADAM</span>
              <h4 className="text-sm font-bold text-slate-900">Navbatlarni qabul qiling</h4>
              <p className="text-xs text-slate-500">Kelingan mijozlarni veb-panel yoki Telegram bot orqali chaqiring.</p>
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="mt-10 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
          <div>
            <h3 className="text-lg sm:text-xl font-bold">Bugunoq boshlashga tayyormisiz?</h3>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-lg">
              NavbatBor platformasiga ulanish bepul va birinchi 14 kunlik barcha imkoniyatlar to‘liq ochiq.
            </p>
          </div>
          <button
            onClick={onOpenOnboarding}
            className="px-6 py-3.5 bg-white hover:bg-slate-100 text-blue-900 font-bold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer shrink-0 active:scale-95"
          >
            Biznesni ulash (Bepul)
          </button>
        </div>
      </div>
    </div>
  );
};
