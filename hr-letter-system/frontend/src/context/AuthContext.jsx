import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // FIX #13: global 401 interceptor — redirect to login when JWT expires mid-session
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        // 401 = unauthorised, 422 = flask-jwt invalid/expired token
        if (err.response?.status === 401 || err.response?.status === 422) {
          // Don't redirect if this is the login endpoint itself
          const url = err.config?.url || '';
          if (!url.includes('/api/auth/login') && !url.includes('/api/auth/profile')) {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
            window.location.hash = '/';
          }
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get('/api/auth/profile')
        .then(res => setUser(res.data))
        .catch(err => {
          // FIX #13 (AuthContext): only clear token on 401/422, not network errors
          if (err.response?.status === 401 || err.response?.status === 422) {
            localStorage.removeItem('token');
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await axios.post('/api/auth/login', { email, password });
    const { token } = res.data;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Fetch full profile so personal fields are available immediately
    const profile = await axios.get('/api/auth/profile');
    setUser(profile.data);
    return profile.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updateUser = (fields) => {
    setUser(prev => ({ ...prev, ...fields }));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);