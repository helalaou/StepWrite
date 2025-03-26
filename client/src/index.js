import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
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
  typography: {
    h2: {
      fontSize: '3rem',
      '@media (max-width:600px)': {
        fontSize: '2.5rem',
      },
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);

reportWebVitals();
