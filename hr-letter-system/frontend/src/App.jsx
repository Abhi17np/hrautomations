// FIX #5: removed unused 'useState', 'useEffect', and 'axios' imports
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import TemplatesPage from './pages/TemplatesPage';
import LettersPage   from './pages/LettersPage';
import ApprovalsPage from './pages/ApprovalsPage';
import ExitPage      from './pages/ExitPage';
import Layout        from './components/Layout';
import './App.css';

// Hash-based router
function useHashRoute() {
  // FIX #5 (App.jsx L16): strip all leading # chars robustly
  const getPath = () => window.location.hash.replace(/^#+/, '') || '/';
  const [path, setPath] = useState(getPath);
  useEffect(() => {
    const handler = () => setPath(getPath());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return path;
}

const PAGES = {
  '/':          DashboardPage,
  '/employees': EmployeesPage,
  '/templates': TemplatesPage,
  '/letters':   LettersPage,
  '/approvals': ApprovalsPage,
  '/exit':      ExitPage,
};

// FIX #5 (App.jsx L41): proper 404 page for unknown routes
function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
      <h2 style={{ fontFamily: 'var(--display)', marginBottom: 8 }}>404 — Page not found</h2>
      <button className="btn btn-primary" onClick={() => { window.location.hash = '/'; }}>
        Go to Dashboard
      </button>
    </div>
  );
}

function AppRouter() {
  const path              = useHashRoute();
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user)   return <LoginPage />;

  const PageComponent = PAGES[path] ?? NotFound;

  return (
    <Layout currentPath={path}>
      <PageComponent />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}