import React from 'react';
import { createRoot } from 'react-dom/client';

import { initAnalytics } from './analytics/analytics';
import { App } from './App';
import './styles/global.css';
/*
 * v0.4.7 lives in its own file. global.css is past 3,000 lines and the mobile density work is a
 * coherent unit - keeping it separate makes it reviewable and, if it ever needs reverting, one
 * import rather than an archaeology exercise.
 */
import './styles/density.css';
// v0.9: the cinematic game-feel layer, on top of the base system.
import './styles/gamefeel.css';

/*
 * Analytics is initialised before the first render so the consent bar knows on its first paint
 * whether this environment would emit at all. It is a no-op in dev, in tests, on localhost, in
 * the gallery and under every browser audit - see src/analytics/analytics.ts.
 */
initAnalytics();

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
