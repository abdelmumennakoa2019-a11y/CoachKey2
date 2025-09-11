import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Ensure DOM is fully loaded before mounting React
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error('Root element not found. Make sure there is a <div id="root"></div> in your HTML.');
    return;
  }
  
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
});