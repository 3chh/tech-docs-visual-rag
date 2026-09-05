import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { en } from "./dictionaries/en";
import { vi } from "./dictionaries/vi";
import type { Language, TranslationDictionary } from "./types";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof TranslationDictionary, params?: Record<string, string | number>) => string;
  dict: TranslationDictionary;
}

const STORAGE_KEY = "cosmo_chatpdf_lang";

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "vi") return stored;
    } catch {
      // ignore
    }
    return "vi";
  });

  const dict = language === "vi" ? vi : en;

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }

  function toggleLanguage() {
    setLanguage(language === "vi" ? "en" : "vi");
  }

  function t(key: keyof TranslationDictionary, params?: Record<string, string | number>): string {
    let text = dict[key] ?? vi[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return text;
  }

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, toggleLanguage, t, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
