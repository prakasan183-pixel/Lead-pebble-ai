import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against third-party Google Maps script errors tripping unhandled error overlay
window.addEventListener('error', (event) => {
  const msg = String(event.message || '');
  if (
    msg.includes('Google Maps JavaScript API error') ||
    msg.includes('InvalidKeyMapError') ||
    msg.includes('Script error.') ||
    event.filename?.includes('maps.googleapis.com')
  ) {
    console.warn('[Global Guard] Handled Google Maps script notice:', msg);
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
