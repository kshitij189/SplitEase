import React, { useMemo } from 'react';
import '../styles/summary.css';

/**
 * Detailed view of all members in a group.
 * Matches design from user's second image.
 */
function GroupMembersDetail({ users, expenses, debts, onBack }) {
  
  // Calculate spending and net balance per user
  const memberStats = useMemo(() => {
    const stats = {};
    users.forEach(u => {
      stats[u.username] = { name: u.username, spent: 0, net: 0 };
    });

    expenses.forEach(e => {
      // If multi-payer is supported and lenders data exists, use it
      if (e.lenders && e.lenders.length > 0) {
        e.lenders.forEach(l => {
          const lName = l.username.toLowerCase();
          if (stats[lName]) {
            stats[lName].spent += l.amount;
          }
        });
      } else {
        // Fallback to single lender field
        const lender = e.lender.toLowerCase();
        if (stats[lender]) {
          stats[lender].spent += e.amount;
        }
      }
    });

    // Net balance calculation: 
    // We can use the 'debts' prop which is the simplified debt list.
    // Net for a person = (Sum of debts where they are TO) - (Sum of debts where they are FROM)
    debts.forEach(d => {
      if (stats[d.from_user]) stats[d.from_user].net -= d.amount;
      if (stats[d.to_user]) stats[d.to_user].net += d.amount;
    });

    return Object.values(stats).sort((a, b) => b.spent - a.spent);
  }, [users, expenses, debts]);

  const fmtFull = (cents) => '₹' + (cents / 100).toLocaleString('en-IN');
  const fmtNet = (cents) => {
    const prefix = cents >= 0 ? '' : '-';
    // Match image: positive is green, negative is red/pink
    return `${prefix}₹${(Math.abs(cents) / 100).toLocaleString('en-IN')}`;
  };

  const colors = ['#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  const getColor = (name) => colors[name.charCodeAt(0) % colors.length];

  return (
    <div className="members-detail-overlay">
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h2>Members</h2>
      </div>

      <div className="members-detail-list">
        {memberStats.map(m => (
          <div key={m.name} className="member-detail-card">
            <div className="member-info-left">
              <div className="member-detail-av" style={{background: getColor(m.name)}}>
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div className="member-main-text">
                <span className="member-name">{m.name}</span>
                <span className="member-spent-label">Spent: {fmtFull(m.spent)}</span>
              </div>
            </div>
            <div className={`member-balance-right ${m.net >= 0 ? 'bal-pos' : 'bal-neg'}`}>
              {fmtNet(m.net)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GroupMembersDetail;
