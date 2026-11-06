import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createAppTheme } from '../theme';
import { applySettings, loadSettings, saveSettings } from '../utils/settings';

const SettingsContext = createContext(null);

// The settings, a way to change them, and whether the Settings pane is open
export const useSettings = () => useContext(SettingsContext);

// The phone apps' system bars (window.Capacitor exists only in the iPhone and
// Android apps in mobile/): light icons on a dark page and dark ones on a light
// page, over the page's own background. On Android the Appearance plugin colors
// the strips behind the bars; on iPhone they follow the theme-color.
function matchSystemBars(mode, background) {
  const plugins = window.Capacitor?.Plugins;
  plugins?.SystemBars?.setStyle({ style: mode === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {});
  plugins?.Appearance?.setBackgroundColor({ color: background }).catch(() => {});
}

function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = loadSettings();
    applySettings(saved);
    return saved;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const mode = settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme;
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    const background = theme.palette.background.default;
    document.documentElement.dataset.theme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
    matchSystemBars(mode, background);
  }, [mode, theme]);

  // Applied to config before the state change re-renders anything
  const updateSettings = useCallback(changes => {
    setSettings(previous => {
      const next = { ...previous, ...changes };
      applySettings(next);
      saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    settings,
    updateSettings,
    isSettingsOpen,
    openSettings: () => setIsSettingsOpen(true),
    closeSettings: () => setIsSettingsOpen(false),
  }), [settings, updateSettings, isSettingsOpen]);

  return (
    <SettingsContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </SettingsContext.Provider>
  );
}

export default SettingsProvider;
