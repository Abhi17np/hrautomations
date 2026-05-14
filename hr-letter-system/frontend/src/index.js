import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import axios from 'axios';

// Point all API calls to the Google Cloud Run backend
axios.defaults.baseURL = 'https://hr-325528727950.us-central1.run.app';

const root = ReactDOM.createRoot(document.getElementById('root'));

// NOTE: React.StrictMode intentionally double-invokes useEffect in development
// to surface side-effects. Removed here because it caused every API call to
// fire twice, polluting Flask logs and wasting MongoDB round-trips.
root.render(<App />);