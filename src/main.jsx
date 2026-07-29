import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// No StrictMode: the game loop is an imperative effect with paced async steps,
// and dev double-invocation would double-fire AI turns.
createRoot(document.getElementById('root')).render(<App />);
