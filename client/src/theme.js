import { createTheme } from '@mui/material/styles';

// Colors outside the MUI palette (the listening blue, success green, error red
// and see-through surfaces) are CSS variables in index.css, switched by the
// data-theme attribute that SettingsProvider sets on <html>.
const palettes = {
  light: {
    primary: {
      main: '#a12614',
      light: '#c44d3f',
    },
    secondary: {
      main: '#2b4c7e',  // Deep blue
      light: '#4676bd',  // Lighter blue
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
  },
  // Lighter brand colors keep their contrast on dark surfaces; `light` is the
  // filled background behind white text, so it stays a mid tone.
  dark: {
    primary: {
      main: '#f08c7c',
      light: '#b23b29',
    },
    secondary: {
      main: '#8fb3ea',
      light: '#3d64a3',
    },
    background: {
      default: '#121212',
      paper: '#1c1c1c',
    },
  },
};

// The logo's navy lettering is lightened in the dark version
export const logoSrc = mode => (mode === 'dark' ? '/images/logo-dark.png' : '/images/logo.png');

export function createAppTheme(mode) {
  return createTheme({
    palette: { mode, ...palettes[mode] },
    typography: {
      h2: {
        fontSize: '3rem',
        '@media (max-width:600px)': {
          fontSize: '2.5rem',
        },
      },
    },
  });
}
