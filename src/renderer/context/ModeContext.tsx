import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api-client';

export type AppMode = 'simple' | 'full';

interface ModeContextValue {
  mode: AppMode;
  setMode: (m: AppMode) => Promise<void>;
  loaded: boolean;
  initialized: boolean;
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'full',
  setMode: async () => {},
  loaded: false,
  initialized: false,
});

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<AppMode>('full');
  const [loaded, setLoaded] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    api.getSetting('app_mode').then(v => {
      if (v === 'simple' || v === 'full') {
        setModeState(v);
        setInitialized(true);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const setMode = useCallback(async (m: AppMode) => {
    await api.setSetting('app_mode', m);
    setModeState(m);
    if (!initialized) setInitialized(true);
  }, [initialized]);

  return (
    <ModeContext.Provider value={{ mode, setMode, loaded, initialized }}>
      {children}
    </ModeContext.Provider>
  );
};

export function useMode() {
  return useContext(ModeContext);
}
