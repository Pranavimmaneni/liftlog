import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './styles/app.css';
import { router } from './app/router';
import { logError } from './db/errors';

window.addEventListener('error', (e) => void logError(e.error ?? e.message, location.pathname));
window.addEventListener('unhandledrejection', (e) => void logError(e.reason, location.pathname));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
