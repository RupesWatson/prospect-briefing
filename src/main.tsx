import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadFromLocalStorage } from './persistence';
import { restartSimulation } from './simulation';

// Load persisted data before render
loadFromLocalStorage();
restartSimulation();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
