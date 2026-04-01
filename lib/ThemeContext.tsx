import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'dark' | 'light';

export const themes = {
  dark: {
    bg: '#07070d',
    card: '#13131a',
    sidebarBg: '#0f0f1a',
    border: '#2a2a40',
    text: '#ffffff',
    subText: '#888888',
    accent: '#7c6fff',
    tabBar: '#0a0a12',
    tabBorder: '#1a1a2e',
    tabInactive: '#44445a',
    inputBg: '#13131a',
    cardTitle: '#7c6fff',
    rowLabel: '#888888',
    rowValue: '#eeeeee',
  },
  light: {
    bg: '#eeeef8',
    card: '#ffffff',
    sidebarBg: '#f8f8ff',
    border: '#d8d8ee',
    text: '#0d0d20',
    subText: '#7070a0',
    accent: '#6c5fff',
    tabBar: '#ffffff',
    tabBorder: '#deddf0',
    tabInactive: '#aaaacc',
    inputBg: '#e8e8f5',
    cardTitle: '#6c5fff',
    rowLabel: '#7070a0',
    rowValue: '#1a1a30',
  },
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: typeof themes.dark;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: themes.dark,
  setMode: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then(v => {
      if (v === 'light' || v === 'dark') setModeState(v);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem('app_theme', m);
  };

  return (
    <ThemeContext.Provider value={{ mode, colors: themes[mode], setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
