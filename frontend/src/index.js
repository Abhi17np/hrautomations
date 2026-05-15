import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import axios from 'axios';

// Set API base URL: Use local backend if running on localhost, otherwise use Cloud Run
const isLocal = window.location.hostname === 'localhost';
axios.defaults.baseURL = isLocal 
  ? 'http://localhost:5050' 
  : 'https://hr-325528727950.us-central1.run.app';

const root = ReactDOM.createRoot(document.getElementById('root'));

// NOTE: React.StrictMode intentionally double-invokes useEffect in development
// to surface side-effects. Removed here because it caused every API call to
// fire twice, polluting Flask logs and wasting MongoDB round-trips.
root.render(<App />);