import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Tier 1: Google Maps Platform Demo Key auth/quota failure & console error listener
declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

window.gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  try {
    const joined = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (
      joined.includes('OverQuotaMapError') ||
      joined.includes('QuotaExceeded') ||
      joined.includes('RESOURCE_EXHAUSTED') ||
      joined.includes('OVER_QUERY_LIMIT')
    ) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  } catch {
    // ignore serialization errors
  }
  originalConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
