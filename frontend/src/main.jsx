import React from 'react';
import { createRoot } from 'react-dom/client';
import TelegramAnalytics from '@telegram-apps/analytics';
import App from './App.jsx';
import './styles/App.css';

const analyticsToken   = import.meta.env.VITE_TELEGRAM_SDK_KEY;
const analyticsAppName = import.meta.env.VITE_TELEGRAM_SDK_APPNAME;

if (analyticsToken && analyticsAppName) {
  TelegramAnalytics.init({ token: analyticsToken, appName: analyticsAppName });
}

createRoot(document.getElementById('root')).render(<App />);
