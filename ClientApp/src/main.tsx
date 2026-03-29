import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle auth exchange code BEFORE React mounts
// This prevents issues with StrictMode double-rendering and route guards
const urlParams = new URLSearchParams(window.location.search);
const exchangeCode = urlParams.get('code');
const currentPath = window.location.pathname;

if (exchangeCode && (currentPath === '/dashboard' || currentPath === '/login')) {
  // Exchange the code for a JWT token before mounting React
  fetch('/api/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: exchangeCode })
  })
    .then(res => res.json())
    .then(data => {
      if (data.token) {
        localStorage.setItem('token', data.token);
        // Clean URL and mount React
        window.history.replaceState({}, '', '/dashboard');
      }
      mountApp();
    })
    .catch(() => {
      mountApp();
    });
} else {
  mountApp();
}

function mountApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
