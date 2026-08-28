import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles/global.css';
/*
 * v0.4.7 lives in its own file. global.css is past 3,000 lines and the mobile density work is a
 * coherent unit - keeping it separate makes it reviewable and, if it ever needs reverting, one
 * import rather than an archaeology exercise.
 */
import './styles/density.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
