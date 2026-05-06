import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

// NOTE: React.StrictMode intentionally double-invokes useEffect in development
// to surface side-effects. Removed here because it caused every API call to
// fire twice, polluting Flask logs and wasting MongoDB round-trips.
root.render(<App />);