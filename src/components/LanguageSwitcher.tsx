import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';

interface LanguageSwitcherProps {
  className?: string;
  idPrefix?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  idPrefix = 'nav',
}) => {
  const { lang, setLang, languages, currentLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: Language) => {
    setLang(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id={`${idPrefix}-language-btn`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Change language"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/60 rounded-xl transition cursor-pointer select-none min-h-[38px]"
      >
        <span className="text-sm leading-none">{currentLanguage.flag}</span>
        <span className="font-extrabold uppercase text-[11px] tracking-wider text-slate-800">
          {currentLanguage.shortLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-slate-400" />
            <span>Til / Язык / Language</span>
          </div>

          <div className="p-1 space-y-0.5">
            {languages.map((l) => {
              const isSelected = l.code === lang;
              return (
                <button
                  key={l.code}
                  id={`${idPrefix}-lang-opt-${l.code}`}
                  type="button"
                  onClick={() => handleSelect(l.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{l.flag}</span>
                    <span>{l.nativeLabel}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
