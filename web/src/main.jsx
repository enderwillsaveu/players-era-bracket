import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import './styles.css';

// Repaint the last picked team's colors before React's first render, so a
// reload doesn't flash the default theme while the first fetch is in flight.
try {
  const p = JSON.parse(localStorage.getItem('pe.theme') || 'null');
  if (p) {
    const root = document.documentElement.style;
    root.setProperty('--brand', p.primary);
    root.setProperty('--accent', p.accent);
    root.setProperty('--accent-2', p.accent2);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.primary);
  }
} catch {
  /* storage unavailable or bad value: keep defaults */
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
