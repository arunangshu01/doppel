import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const apiBase = (import.meta.env.VITE_API_URL || '/doppel/api/v1').replace(/\/$/, '');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App apiBase={apiBase} />
  </React.StrictMode>,
);
