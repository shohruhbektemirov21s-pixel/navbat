import React from 'react';
import {
  ArrowLeft, Clock, Smartphone, Calendar, Bell,
  ShieldCheck, Sparkles, Send
} from 'lucide-react';

interface CustomerBenefitsPageProps {
  onBack: () => void;
  onExplore: () => void;
}

export const CustomerBenefitsPage: React.FC<CustomerBenefitsPageProps> = ({
  onBack,
  onExplore,
}) => {
  const benefits = [
    {
      icon: Clock,
      title: 'Tirbandliksiz va behuda kutishlarsiz',
      desc: 'Shifoxona, sartaroshxona yoki servisda soatlab kutib o‘tirmaysiz. Navbatingiz yetib kelguncha o‘z ishlaringiz bilan mashg‘ul bo‘ling.',
      badge: 'Vaqtni tejash'
    },
    {
      icon: Smartphone,
      title: 'Jonli navbatni masofadan kuzatish',
      desc: 'Oldingizda necha kishi borligini va taxminiy kutish vaqtini istalgan joydan turib real vaqt rejimida telefoningizda ko‘ring.',
      badge: 'Real-vaqt'
    },
    {
      icon: Calendar,
      title: 'Aniq soatga qulay onlayn bronlash',
      desc: 'Istalgan mutaxassisning bo‘sh vaqtlarini ko‘ring va o‘zingizga mos vaqtni 1 daqiqada band qiling.',
      badge: '24/7 qabul'
    },
    {
      icon: Bell,
      title: 'Telegram va SMS eslatmalar',
      desc: 'Navbatingizga 2 kishi qolganida yoki qabul vaqti yaqinlashganda Telegram botingizga avtomatik eslatma keladi.',
      badge: 'Xabardorlik'
    },
    {
      icon: ShieldCheck,
      title: 'Haqiqiy sharhlar va shaffof baholar',
      desc: 'Faqat xizmatdan foydalangan mijozlar sharh qoldira oladi. Eng yaxshi va ishonchli mutaxassislarni osongina tanlang.',
      badge: 'Ishonch'
    },
    {
      icon: Send,
      title: 'Telegram Bot orqali 1-bosishda xizmat',
      desc: '@Navbat1Uzb_bot orqali ilovani yuklab olmasdan ham navbat olish, chekni saqlash va xabarlar olish mumkin.',
      badge: 'Telegram 1-Click'
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
          <span className="text-xs font-semibold text-slate-400">NavbatBor Mijozlar uchun</span>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-b from-blue-900 to-slate-900 text-white py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-semibold text-blue-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>Mijozlar uchun barcha afzalliklar</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Kutishlarsiz xizmat olish madaniyati
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto font-normal">
            NavbatBor yordamida vaqtingizni navbat kutishga emas, o‘zingiz va oilangizga sarflang.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={onExplore}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-500/30 transition cursor-pointer active:scale-95"
            >
              Biznes va xizmatlarni topish
            </button>
            <a
              href="https://t.me/Navbat1Uzb_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 bg-[#2AABEE] hover:bg-[#229ED9] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4 fill-white" />
              <span>Telegram Botda sinab ko‘rish</span>
            </a>
          </div>
        </div>
      </div>

      {/* Grid of Benefits */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {benefits.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-blue-300 hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {b.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{b.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3 Step Flow */}
        <div className="mt-12 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-6 text-center">
            Navbat olish qanday ishlaydi?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow-sm">
                1
              </div>
              <h4 className="text-sm font-bold text-slate-900">1. Xizmatni tanlang</h4>
              <p className="text-xs text-slate-500">Klinika, go‘zallik saloni yoki avtoservisni toping.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow-sm">
                2
              </div>
              <h4 className="text-sm font-bold text-slate-900">2. Navbat yoki bron</h4>
              <p className="text-xs text-slate-500">1 bosishda elektron chipta oling yoki qulay vaqtni band qiling.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow-sm">
                3
              </div>
              <h4 className="text-sm font-bold text-slate-900">3. O‘z vaqtida boring</h4>
              <p className="text-xs text-slate-500">Navbatingiz kelganda SMS/Telegram xabar bilan ogohlantirilasiz.</p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 text-center pt-4">
          <button
            onClick={onExplore}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition cursor-pointer"
          >
            Katalogga o‘tish va navbat olish
          </button>
        </div>
      </div>
    </div>
  );
};
