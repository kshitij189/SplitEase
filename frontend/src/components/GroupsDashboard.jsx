import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Logo from './Logo';
import '../styles/groups.css';

const GroupsDashboard = ({ user, onLogout }) => {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get('/groups');
      setGroups(response.data);
    } catch (err) {
      console.error('Failed to fetch groups', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const response = await axios.post('/groups', { name: newGroupName });
      setGroups([response.data, ...groups]);
      setNewGroupName('');
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to create group', err);
    }
  };

  const handleGroupClick = (groupId) => {
    navigate(`/groups/${groupId}`);
  };

  if (loading) return <div className="groups-loading">Loading your groups...</div>;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Logo size={26} />
          <div className="user-controls">
            <span>Welcome, <strong>{user?.firstName || user?.username}</strong>!</span>
            <button onClick={onLogout} className="logout-button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-top">
          <h2>Your Groups</h2>
          <button 
            className="create-group-btn"
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? 'Cancel' : '+ New Group'}
          </button>
        </div>

        {isCreating && (
          <form className="create-group-form" onSubmit={handleCreateGroup}>
            <input
              type="text"
              placeholder="What's the group name? (e.g., Goa Trip, Flat 402)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={!newGroupName.trim()}>Create</button>
          </form>
        )}

        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No groups yet</h3>
            <p>Create a group to start splitting expenses with your friends, roommates, or travel buddies.</p>
            {!isCreating && (
              <button 
                className="create-first-group-btn"
                onClick={() => setIsCreating(true)}
              >
                Create your first group
              </button>
            )}
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map(group => (
              <div 
                key={group.id} 
                className="group-card"
                onClick={() => handleGroupClick(group.id)}
              >
                <div className="group-card-header">
                  <h3>{group.name}</h3>
                  <span className="member-count">
                    {group.members?.length || 0} {(group.members?.length === 1) ? 'member' : 'members'}
                  </span>
                </div>
                <div className="group-card-footer">
                  <span className="created-date">Created {new Date(group.created_at).toLocaleDateString()}</span>
                  <button className="view-group-btn">→</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default GroupsDashboard;
