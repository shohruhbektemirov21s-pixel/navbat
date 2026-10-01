import React from 'react';
import { Send } from 'lucide-react';
import { NavbatBorLogo } from './NavbatBorLogo';

interface FooterProps {
  onOpenLegal: (type: 'privacy' | 'terms' | 'support') => void;
  onOpenBusinessOnboarding: () => void;
  onNavigate?: (view: 'home' | 'search' | 'for-customers' | 'for-business') => void;
}

export const Footer: React.FC<FooterProps> = ({ 
  onOpenLegal, 
  onOpenBusinessOnboarding,
  onNavigate 
}) => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 pb-16 md:pb-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          {/* Logo & Tagline */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <NavbatBorLogo variant="horizontal" size="sm" lightText={true} />
            <span className="hidden sm:inline-block text-slate-600">|</span>
            <p className="text-slate-400 text-xs">
              Kutib o‘tirmang. Navbatingizni oldindan oling.
            </p>
          </div>

          {/* Essential Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 font-medium">
            <button
              onClick={() => onNavigate ? onNavigate('home') : window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="hover:text-white transition cursor-pointer"
            >
              Bosh sahifa
            </button>
            <button
              onClick={() => onNavigate ? onNavigate('for-customers') : null}
              className="hover:text-white transition cursor-pointer"
            >
              Mijozlar uchun
            </button>
            <button
              onClick={() => onNavigate ? onNavigate('for-business') : onOpenBusinessOnboarding()}
              className="hover:text-white transition cursor-pointer"
            >
              Bizneslar uchun
            </button>
            <a
              href="https://t.me/Navbat1Uzb_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2AABEE] hover:text-[#52c1fa] flex items-center gap-1 font-semibold"
            >
              <Send className="w-3.5 h-3.5 fill-[#2AABEE]" />
              <span>@Navbat1Uzb_bot</span>
            </a>
          </div>
        </div>

        {/* Bottom row: Legal & Copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} NavbatBor. Barcha huquqlar himoyalangan.
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onOpenLegal('terms')}
              className="hover:text-slate-400 transition cursor-pointer"
            >
              Foydalanish shartlari
            </button>
            <span>·</span>
            <button
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-slate-400 transition cursor-pointer"
            >
              Maxfiylik siyosati
            </button>
            <span>·</span>
            <button
              onClick={() => onOpenLegal('support')}
              className="hover:text-slate-400 transition cursor-pointer"
            >
              Qo‘llab-quvvatlash
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
