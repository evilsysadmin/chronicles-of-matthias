// CI-only fixture: mount the actual production React/Suspense loader without
// fake SSO, a test-only route in the shipped application, or game state.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import '../src/styles/29-motion-coherence.css';
import '../src/styles/30-modal-layering.css';
import LoadingScreen from '../src/standalone/LoadingScreen.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><LoadingScreen /></React.StrictMode>,
);