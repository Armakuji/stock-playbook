"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Lang } from "./i18n";

const STORAGE_KEY = "srw-lang";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LangCtx>({
  lang: "en",
  setLang: () => {},
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default EN on server + first client render to avoid hydration mismatch;
  // hydrate the stored preference in an effect after mount.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "th") setLangState(saved);
    } catch {
      /* localStorage unavailable — stay on default */
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore persistence failure */
    }
  };

  const toggle = () => setLang(lang === "en" ? "th" : "en");

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): LangCtx {
  return useContext(LanguageContext);
}
