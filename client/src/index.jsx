import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import SettingsProvider from './components/SettingsProvider';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <SettingsProvider>
    <App />
  </SettingsProvider>
);

reportWebVitals();
