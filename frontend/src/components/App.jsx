import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import axios from 'axios';
import AuthPage from './AuthPage';
import GroupsDashboard from './GroupsDashboard';
import GroupView from './GroupView';
import LandingPage from './LandingPage';
import InvitePage from './InvitePage';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

// Setup axios interceptor for token refresh
const setupAxiosInterceptors = (onLogout) => {
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            const response = await axios.post('/auth/token/refresh', {
              refresh: refreshToken,
            });
            const { access, refresh } = response.data;

            localStorage.setItem('token', access);
            localStorage.setItem('refreshToken', refresh);
            axios.defaults.headers.common['Authorization'] = `Bearer ${access}`;

            originalRequest.headers['Authorization'] = `Bearer ${access}`;
            return axios(originalRequest);
          } catch (refreshError) {
            onLogout();
            return Promise.reject(refreshError);
          }
        } else {
          onLogout();
        }
      }
      return Promise.reject(error);
    }
  );
};

// Wrapper to handle invite redirect after auth
const AuthWithInviteRedirect = ({ onAuthSuccess, initialMode }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inviteCode = searchParams.get('invite');

  const handleAuth = (userData) => {
    onAuthSuccess(userData);
    if (inviteCode) {
      navigate(`/invite/${inviteCode}`);
    } else {
      navigate('/groups');
    }
  };

  return <AuthPage onAuthSuccess={handleAuth} initialMode={initialMode} />;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      axios.post('/auth/logout', { refresh: refreshToken }).catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    setupAxiosInterceptors(handleLogout);

    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, [handleLogout]);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  const PrivateRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Routes>
        <Route
          path="/login"
          element={
            user ? <Navigate to="/groups" replace /> :
            <AuthWithInviteRedirect onAuthSuccess={handleAuthSuccess} initialMode="login" />
          }
        />

        <Route
          path="/signup"
          element={
            user ? <Navigate to="/groups" replace /> :
            <AuthWithInviteRedirect onAuthSuccess={handleAuthSuccess} initialMode="signup" />
          }
        />

        <Route
          path="/invite/:inviteCode"
          element={<InvitePage user={user} onAuthSuccess={handleAuthSuccess} />}
        />

        <Route
          path="/groups"
          element={
            <PrivateRoute>
              <GroupsDashboard user={user} onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        <Route
          path="/groups/:groupId"
          element={
            <PrivateRoute>
              <GroupView user={user} onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        <Route path="/" element={<LandingPage user={user} />} />
      </Routes>
    </GoogleOAuthProvider>
  );
};

export default App;
