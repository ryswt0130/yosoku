import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Default CRA CSS
import 'leaflet/dist/leaflet.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
