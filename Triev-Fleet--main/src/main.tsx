import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { inject } from '@vercel/analytics'
import { SpeedInsights } from '@vercel/speed-insights/react'

// Initialize Vercel Web Analytics
try {
  inject();
} catch (e) {
  // Ignore analytics init failure in non-Vercel env
}

// Watchdog: If #root is still displaying default loading text after 5s, offer manual reset button
setTimeout(() => {
  const rootEl = document.getElementById('root');
  if (rootEl && rootEl.innerText.includes('Loading Rider App...')) {
    rootEl.innerHTML = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; font-family: system-ui; text-align: center;">
        <div style="width: 48px; height: 48px; border: 4px solid #6366f1; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px;"></div>
        <h2 style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">Loading Triev Fleet V2...</h2>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 20px 0;">Taking longer than expected to connect.</p>
        <button onclick="localStorage.clear(); sessionStorage.clear(); location.reload();" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(99,102,241,0.3);">
          Reset App &amp; Reload
        </button>
      </div>
    `;
  }
}, 5000);

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');

  createRoot(rootElement).render(
    <StrictMode>
      <GlobalErrorBoundary>
        <App />
        <SpeedInsights />
      </GlobalErrorBoundary>
    </StrictMode>,
  );
} catch (error) {
  console.error('Failed to mount application:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif; text-align: center;">
      <h1>Application Failed to Start</h1>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
      <button onclick="localStorage.clear(); location.reload();" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px;">Reset Cache & Reload</button>
    </div>
  `;
}
