import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { injectSpeedInsights } from '@vercel/speed-insights'

// console.log('Main.tsx executing');

// Initialize Vercel Speed Insights
injectSpeedInsights();

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');

  createRoot(rootElement).render(
    <StrictMode>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    </StrictMode>,
  )
} catch (error) {
  console.error('Failed to mount application:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Application Failed to Start</h1>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
    </div>
  `;
}
