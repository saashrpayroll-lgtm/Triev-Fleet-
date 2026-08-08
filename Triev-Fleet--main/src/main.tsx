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
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Application Failed to Start</h1>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
    </div>
  `;
}
