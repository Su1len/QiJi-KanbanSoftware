import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api-client';
import type { Lang } from '../i18n';
import { tr, trFmt } from '../i18n';

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (key: string) => string;
  tf: (key: string, vars: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'zh',
  setLang: async () => {},
  t: (k) => k,
  tf: (k) => k,
});

// 模块级当前语言，供非组件代码（如 ThemeContext.t）读取
export let currentLang: Lang = 'zh';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>('zh');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getSetting('lang').then(v => {
      if (v === 'zh' || v === 'en') {
        setLangState(v);
        currentLang = v;
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    await api.setSetting('lang', l);
    setLangState(l);
    currentLang = l;
  }, []);

  const t = useCallback((key: string) => tr(key, lang), [lang]);
  const tf = useCallback((key: string, vars: Record<string, string | number>) => trFmt(key, lang, vars), [lang]);

  if (!loaded) return <>{children}</>;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tf }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLang() {
  return useContext(LanguageContext);
}
