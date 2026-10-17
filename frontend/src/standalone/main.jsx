// Shell standalone del juego (login → libro de expediciones). El juego vive en
// frontend/src; su origen en Chess Studio está en docs/PROVENANCE.md.
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles.css';
import '../styles/29-motion-coherence.css';
import '../styles/30-modal-layering.css';
import { getReducedMotionPreference, reducedMotionStatus } from '../userPreferences.js';
import App from './App.jsx';

// Mismo arranque de preferencias de movimiento que Chess Studio.
const initialMotion = reducedMotionStatus();
document.documentElement.dataset.reducedMotion = initialMotion.effective ? 'true' : 'false';
document.documentElement.dataset.motionPreference = getReducedMotionPreference();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
