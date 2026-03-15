import React, { useState } from 'react';
import AddUser from './AddUser';
import BubbleChart from './BubbleChart';
import '../styles/group_users.css';

function GroupUsers({
  user,
  users,
  debts,
  smartSplit,
  onToggleSmartSplit,
  onAddUser,
  onSettle,
  settleMessage,
  onShowDetails
}) {
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  const fmt = (cents) => '₹' + (cents / 100).toFixed(2);

  const handleSettle = () => {
    if (!settleFrom || !settleTo || !settleAmount || parseFloat(settleAmount) <= 0) return;
    onSettle(settleFrom, settleTo, Math.round(parseFloat(settleAmount) * 100), () => setSettleAmount(''));
  };

  // Auto-fill amount when users are selected
  React.useEffect(() => {
    if (settleFrom && settleTo && settleFrom !== settleTo) {
      const match = debts.find(d => d.from_user === settleFrom && d.to_user === settleTo);
      if (match) {
        setSettleAmount((match.amount / 100).toFixed(2));
      }
    }
  }, [settleFrom, settleTo, debts]);

  const disabled = !settleFrom || !settleTo || !settleAmount || parseFloat(settleAmount) <= 0 || settleFrom === settleTo;

  // avatar colors
  const colors = ['#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  const getColor = (name) => colors[name.charCodeAt(0) % colors.length];

  return (
    <div className="right-stack">

      {/* ── Members Card ─────────────────────────── */}
      <div className="card card-members">
        <div className="card-head">
          <h3>Members</h3>
          <AddUser onAddUser={onAddUser} />
        </div>
        <div className="members-grid">
          {users.map(u => (
            <div key={u.username} className="m-chip" style={{'--accent': getColor(u.username)}}>
              <div className="m-av">{u.username.charAt(0).toUpperCase()}</div>
              <span>{u.username}</span>
            </div>
          ))}
          {users.length === 0 && <p className="muted-text">Add your first member below</p>}
        </div>
      </div>

      {/* ── Visual Insight ─────────────────────────── */}
      <div className="card bubble-viz-card" style={{padding: 0, overflow: 'hidden', border: 'none'}}>
        <BubbleChart users={users} debts={debts} currentUser={user} onClick={onShowDetails} />
      </div>

      {/* ── Balances Card ────────────────────────── */}
      <div className="card card-balances">
        <div className="card-head">
          <h3>{smartSplit ? 'Smart Settlements' : 'Balances'}</h3>
          <div className="toggle-wrap" onClick={onToggleSmartSplit}>
            <span className={`toggle-text ${!smartSplit ? 'active' : ''}`}>All</span>
            <div className={`toggle-track ${smartSplit ? 'on' : ''}`}>
              <div className="toggle-thumb" />
            </div>
            <span className={`toggle-text ${smartSplit ? 'active' : ''}`}>Smart</span>
          </div>
        </div>

        {debts.length === 0 ? (
          <div className="empty-bal">
            <span>✨</span>
            All settled up!
          </div>
        ) : (
          <div className="bal-list">
            {debts.map((d, i) => (
              <div key={i} className="bal-row">
                <div className="bal-people">
                  <div className="bal-av" style={{background: getColor(d.from_user)}}>{d.from_user.charAt(0).toUpperCase()}</div>
                  <div className="bal-names">
                    <span className="bal-from">{d.from_user}</span>
                    <span className="bal-label">→</span>
                    <span className="bal-to">{d.to_user}</span>
                  </div>
                </div>
                <div className="bal-amt">{fmt(d.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Settle Card ──────────────────────────── */}
      <div className="card card-settle">
        <h3>Settle Up</h3>
        <div className="settle-grid">
          <select value={settleFrom} onChange={e => setSettleFrom(e.target.value)}>
            <option value="">Who's paying?</option>
            {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
          </select>
          <div className="settle-arrow-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <select value={settleTo} onChange={e => setSettleTo(e.target.value)}>
            <option value="">Who receives?</option>
            {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
          </select>
        </div>
        <div className="settle-bottom">
          <div className="settle-input-wrap">
            <span className="settle-cur">₹</span>
            <input
              type="number"
              placeholder="0.00"
              value={settleAmount}
              onChange={e => setSettleAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <button className="settle-btn" onClick={handleSettle} disabled={disabled}>
            Settle
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>
        {settleMessage && (
          <div className={`settle-msg ${settleMessage.type}`}>{settleMessage.text}</div>
        )}
      </div>

    </div>
  );
}

export default GroupUsers;
