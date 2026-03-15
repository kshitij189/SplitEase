import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthPage from './AuthPage';
import GroupsDashboard from './GroupsDashboard';
import GroupView from './GroupView';
import LandingPage from './LandingPage';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing session on load
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      axios.defaults.headers.common['Authorization'] = `Token ${token}`;
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    navigate('/groups');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    navigate('/login');
  };

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  // Protected Route Wrapper
  const PrivateRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          user ? <Navigate to="/groups" replace /> : <AuthPage onAuthSuccess={handleAuthSuccess} />
        } 
      />
      
      <Route 
        path="/signup" 
        element={
          user ? <Navigate to="/groups" replace /> : <AuthPage onAuthSuccess={handleAuthSuccess} initialMode="signup" />
        } 
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
  );
};

export default App;
