import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import GroupExpenses from './GroupExpenses';
import GroupUsers from './GroupUsers';
import SplitBotModal from './SplitBotModal';
import ActivityFeed from './ActivityFeed';
import GroupTotalSummary from './GroupTotalSummary';
import GroupMembersDetail from './GroupMembersDetail';
import Logo from './Logo';
import '../styles/app.css';

const GroupView = ({ user, onLogout }) => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [users, setUsers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [debts, setDebts] = useState([]);
  const [smartSplit, setSmartSplit] = useState(false);
  const [settleMessage, setSettleMessage] = useState(null);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShareInvite = () => {
    if (!group?.invite_code) return;
    const inviteUrl = `${window.location.origin}/invite/${group.invite_code}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fetchGroupData = useCallback(async () => {
    try {
      const [groupRes, usersRes, expensesRes] = await Promise.all([
        axios.get(`/groups/${groupId}`),
        axios.get(`/groups/${groupId}/users`),
        axios.get(`/groups/${groupId}/expenses`)
      ]);
      setGroup(groupRes.data);
      setUsers(usersRes.data);
      setExpenses(expensesRes.data);
    } catch (err) {
      console.error('Failed to load group data:', err);
      navigate('/groups');
    }
  }, [groupId, navigate]);

  const fetchDebts = useCallback(async () => {
    try {
      const endpoint = smartSplit ? `/groups/${groupId}/optimisedDebts` : `/groups/${groupId}/debts`;
      const res = await axios.get(endpoint);
      setDebts(res.data);
    } catch (err) {
      console.error('Failed to load debts:', err);
    }
  }, [groupId, smartSplit]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const handleAddUser = async (username) => {
    try {
      await axios.post(`/groups/${groupId}/members`, { username });
      await fetchGroupData();
    } catch (err) {
      console.error(err.response?.data);
      alert(err.response?.data?.error || 'Failed to add user');
    }
  };

  const handleAddExpense = async (expenseData) => {
    try {
      const res = await axios.post(`/groups/${groupId}/expenses`, expenseData);
      setExpenses(prev => [res.data, ...prev]);
      await fetchDebts();
    } catch (err) {
      console.error(err.response?.data);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    try {
      await axios.delete(`/groups/${groupId}/expenses/${expenseId}`);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      await fetchDebts();
    } catch (err) {
      console.error(err.response?.data);
    }
  };

  const handleEditExpense = async (expenseId, expenseData) => {
    try {
      const res = await axios.put(`/groups/${groupId}/expenses/${expenseId}`, expenseData);
      setExpenses(prev => prev.map(e => e.id === expenseId ? res.data : e));
      await fetchDebts();
    } catch (err) {
      console.error(err.response?.data);
    }
  };

  const handleSettle = async (from, to, amount, onSuccess) => {
    try {
      const res = await axios.post(`/groups/${groupId}/debts/settle`, { from, to, amount });
      setSettleMessage({ type: 'success', text: res.data });
      if (onSuccess) onSuccess();
      await fetchDebts();
      await fetchGroupData();
      setTimeout(() => setSettleMessage(null), 2500);
    } catch (err) {
      setSettleMessage({
        type: 'error',
        text: err.response?.data || 'Settlement failed'
      });
      setTimeout(() => setSettleMessage(null), 2500);
    }
  };

  if (!group) return <div className="groups-loading">Loading group...</div>;

  if (showMemberDetails) {
    return (
      <GroupMembersDetail 
        users={users}
        expenses={expenses}
        debts={debts}
        onBack={() => setShowMemberDetails(false)}
      />
    );
  }

  const totalGroupDebt = debts.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="app-shell">
      {/* Decorative blobs */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      <div className="bg-blob blob-3"></div>

      <nav className="navbar">
        <div className="nav-brand">
          <div className="nav-logo-wrapper" onClick={() => navigate('/groups')} style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <Logo size={42} />
            <span className="group-name-badge">/ {group.name}</span>
          </div>
        </div>
        <div className="nav-stats">
          <div className="stat-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', opacity: 0.7}}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>{users.length} members</span>
          </div>
          <div className="stat-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', opacity: 0.7}}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>{expenses.length} expenses</span>
          </div>
          {totalGroupDebt > 0 && (
            <div className="stat-pill stat-debt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', opacity: 0.8}}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              <span>₹{(totalGroupDebt / 100).toFixed(2)} pending</span>
            </div>
          )}
          <button onClick={handleShareInvite} className="stat-pill" style={{cursor: 'pointer', background: copied ? 'rgba(34,197,94,0.15)' : undefined, borderColor: copied ? 'rgba(34,197,94,0.3)' : undefined, color: copied ? '#4ade80' : undefined}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', opacity: 0.7}}>
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <span>{copied ? 'Link Copied!' : 'Share Invite'}</span>
          </button>
          <button onClick={onLogout} className="logout-nav-button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </nav>

      <main className="main-grid">
        <section className="col-left">
          <GroupTotalSummary expenses={expenses} onClick={() => setShowMemberDetails(true)} />
          <GroupExpenses
            user={user}
            users={users}
            expenses={expenses}
            groupId={groupId}
            onShowChat={() => setShowChat(true)}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onEditExpense={handleEditExpense}
          />
        </section>
        <section className="col-right">
          <GroupUsers
            user={user}
            users={users}
            debts={debts}
            smartSplit={smartSplit}
            onToggleSmartSplit={() => setSmartSplit(p => !p)}
            onAddUser={handleAddUser}
            onSettle={handleSettle}
            settleMessage={settleMessage}
            onShowDetails={() => setShowMemberDetails(true)}
          />
          <ActivityFeed groupId={groupId} />
        </section>
      </main>

      {showChat && (
        <SplitBotModal
          groupId={groupId}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
};

export default GroupView;
