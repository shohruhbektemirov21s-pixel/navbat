import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, LANGUAGES, LanguageOption, translations, TranslationKey } from './translations';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  languages: LanguageOption[];
  currentLanguage: LanguageOption;
  translateCategory: (slugOrName: string) => string;
  translateCity: (cityName: string) => string;
}

const STORAGE_KEY = 'navbatbor_lang';

// Translation mappings for dynamic data from DB
const categoryTranslations: Record<string, Record<Language, string>> = {
  stomatologiya: { uz: 'Stomatologiya', ru: 'Стоматология', en: 'Dentistry' },
  dentistry: { uz: 'Stomatologiya', ru: 'Стоматология', en: 'Dentistry' },
  tibbiyot: { uz: 'Tibbiyot', ru: 'Медицина', en: 'Medicine' },
  medicine: { uz: 'Tibbiyot', ru: 'Медицина', en: 'Medicine' },
  gozallik: { uz: 'Go‘zallik', ru: 'Красота и спа', en: 'Beauty & Spa' },
  'beauty-salons': { uz: 'Go‘zallik salonlari', ru: 'Салоны красоты', en: 'Beauty Salons' },
  sartaroshxona: { uz: 'Sartaroshxona', ru: 'Барбершоп', en: 'Barbershop' },
  barbershops: { uz: 'Sartaroshxonalar', ru: 'Барбершопы', en: 'Barbershops' },
  'oquv-markazi': { uz: 'O‘quv markazi', ru: 'Учебные центры', en: 'Education' },
  education: { uz: 'Ta’lim', ru: 'Образование', en: 'Education' },
  avtoservis: { uz: 'Avtoservis', ru: 'Автосервис', en: 'Auto Service' },
  'auto-service': { uz: 'Avtoservis', ru: 'Автосервис', en: 'Auto Service' },
  'car-wash': { uz: 'Avtomoyka', ru: 'Автомойка', en: 'Car Wash' },
  sport: { uz: 'Sport', ru: 'Спорт и фитнес', en: 'Sports & Fitness' },
  konsultatsiya: { uz: 'Konsultatsiya', ru: 'Консультации', en: 'Consulting' },
  boshqa: { uz: 'Boshqa xizmatlar', ru: 'Другие услуги', en: 'Other Services' },
};

const cityTranslations: Record<string, Record<Language, string>> = {
  qarshi: { uz: 'Qarshi', ru: 'Карши', en: 'Qarshi' },
  'qarshi shahri': { uz: 'Qarshi shahri', ru: 'г. Карши', en: 'Qarshi City' },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

/** Dev-only: report each missing translation key once per language. */
const reportedMissingKeys = new Set<string>();
function warnMissingKey(key: string, lang: Language) {
  if (!import.meta.env.DEV) return;
  const id = `${lang}:${key}`;
  if (reportedMissingKeys.has(id)) return;
  reportedMissingKeys.add(id);
  console.warn(`[i18n] "${key}" kaliti "${lang}" tilida topilmadi`);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    // 1. Try localStorage
    const saved = localStorage.getItem(STORAGE_KEY) as Language;
    if (saved && (saved === 'uz' || saved === 'ru' || saved === 'en')) {
      return saved;
    }

    // 2. Try Telegram WebApp user language
    try {
      const tg = (window as any).Telegram?.WebApp;
      const tgLang = tg?.initDataUnsafe?.user?.language_code;
      if (tgLang) {
        if (tgLang.startsWith('ru')) return 'ru';
        if (tgLang.startsWith('en')) return 'en';
        if (tgLang.startsWith('uz')) return 'uz';
      }
    } catch (e) {
      // ignore
    }

    // 3. Try browser navigator
    try {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('ru')) return 'ru';
      if (browserLang.startsWith('en')) return 'en';
    } catch (e) {
      // ignore
    }

    // Default to Uzbek
    return 'uz';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const langDict = translations[lang] || translations.uz;
    let text: string = langDict[key] || translations.uz[key];
    if (!text) {
      warnMissingKey(key as string, lang);
      text = key as string;
    } else if (import.meta.env.DEV && !langDict[key]) {
      warnMissingKey(key as string, lang);
    }

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }

    return text;
  };

  const translateCategory = (slugOrName: string): string => {
    if (!slugOrName) return '';
    const normalized = slugOrName.toLowerCase().trim().replace(/['‘`]/g, '');
    for (const [slug, trans] of Object.entries(categoryTranslations)) {
      if (
        normalized.includes(slug) ||
        normalized === slug ||
        trans.uz.toLowerCase().replace(/['‘`]/g, '') === normalized
      ) {
        return trans[lang] || trans.uz;
      }
    }
    return slugOrName;
  };

  const translateCity = (cityName: string): string => {
    if (!cityName) return '';
    const normalized = cityName.toLowerCase().trim();
    for (const [key, trans] of Object.entries(cityTranslations)) {
      if (normalized.includes(key) || normalized === key) {
        return trans[lang] || trans.uz;
      }
    }
    return cityName;
  };

  const currentLanguage = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        t,
        languages: LANGUAGES,
        currentLanguage,
        translateCategory,
        translateCity,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
