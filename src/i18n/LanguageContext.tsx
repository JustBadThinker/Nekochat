import React, { createContext, useContext, useMemo } from 'react';
import { TRANSLATIONS, TranslationKey, UiLanguage } from './translations';

interface LanguageContextValue {
  language: UiLanguage;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  t: key => TRANSLATIONS.en[key] || key,
});

export const LanguageProvider: React.FC<{
  language?: UiLanguage | string;
  children: React.ReactNode;
}> = ({ language = 'en', children }) => {
  const resolvedLang: UiLanguage =
    language === 'ja' || language === 'fr' || language === 'id' ? language : 'en';

  const value = useMemo<LanguageContextValue>(() => {
    const dict = TRANSLATIONS[resolvedLang] || TRANSLATIONS.en;
    return {
      language: resolvedLang,
      t: key => dict[key] || TRANSLATIONS.en[key] || key,
    };
  }, [resolvedLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslation = (): LanguageContextValue => useContext(LanguageContext);
