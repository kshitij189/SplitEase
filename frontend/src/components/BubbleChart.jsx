import React, { useMemo } from 'react';
import '../styles/bubble.css';

/**
 * BubbleChart visualization matching the user's specific screenshot.
 * Displays members as overlapping green bubbles.
 * 
 * @param {Array} users - List of AuthUser objects
 * @param {Array} debts - List of Debt objects {from_user, to_user, amount}
 * @param {Object} currentUser - The logged-in AuthUser
 */
const BubbleChart = ({ users, debts, currentUser, onClick }) => {
  const balances = useMemo(() => {
    const map = {};
    users.forEach(u => map[u.username] = 0);
    
    debts.forEach(d => {
      if (map[d.from_user] !== undefined) map[d.from_user] += d.amount;
      if (map[d.to_user] !== undefined) map[d.to_user] -= d.amount;
    });
    
    return map;
  }, [users, debts]);

  const activeUsers = useMemo(() => {
    return users
      .map(u => ({
        ...u,
        balance: balances[u.username] || 0
      }))
      .filter(u => u.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [users, balances]);

  const { centerUser, peripheralUsers } = useMemo(() => {
    if (activeUsers.length === 0) return { centerUser: null, peripheralUsers: [] };

    // Find if currentUser is in activeUsers
    const currentIdx = activeUsers.findIndex(u => u.username === currentUser.username);
    
    if (currentIdx !== -1) {
      // Current user is active, they stay center
      const center = activeUsers[currentIdx];
      const others = [...activeUsers];
      others.splice(currentIdx, 1);
      return { centerUser: center, peripheralUsers: others };
    } else {
      // Current user is settled, pick the biggest debtor/creditor as center
      const center = activeUsers[0];
      const others = activeUsers.slice(1);
      return { centerUser: center, peripheralUsers: others };
    }
  }, [activeUsers, currentUser]);

  const fmt = (cents) => {
    const abs = (Math.abs(cents) / 100).toFixed(2);
    // Matching the image: people who owe have -₹ sign
    return (cents >= 0 ? '-' : '+') + '₹' + abs;
  };

  const getLabel = (cents) => {
    return cents >= 0 ? 'should pay' : 'should receive';
  };

  // Layout constants
  const MAX_PERIPHERAL = 6;
  const CENTER_SIZE = 145;
  const PERIPHERAL_SIZE = 110;
  const RADIUS = 110; // Slightly wider for better overlap with more bubbles

  if (!centerUser) return null;

  const displayUsers = peripheralUsers.slice(0, MAX_PERIPHERAL);
  const plusMoreCount = peripheralUsers.length - MAX_PERIPHERAL;

  return (
    <div className="bubble-chart-container" onClick={onClick} style={{cursor: 'pointer'}}>
      {/* Peripheral Bubbles */}
      {displayUsers.map((u, i) => {
        const angle = (i * 2 * Math.PI) / Math.min(peripheralUsers.length, MAX_PERIPHERAL + (plusMoreCount > 0 ? 1 : 0)) - Math.PI / 2;
        const x = RADIUS * Math.cos(angle);
        const y = RADIUS * Math.sin(angle);
        
        return (
          <div 
            key={u.username}
            className="bubble bubble-peripheral"
            style={{
              width: `${PERIPHERAL_SIZE}px`,
              height: `${PERIPHERAL_SIZE}px`,
              transform: `translate(${x}px, ${y}px)`
            }}
          >
            <div className="bubble-name" style={{fontFamily: 'serif'}}>{u.username}</div>
            <div className="bubble-amount" style={{fontSize: '1rem', fontFamily: 'serif'}}>{fmt(u.balance)}</div>
            <div className="bubble-label" style={{fontSize: '0.6rem'}}>{getLabel(u.balance)}</div>
          </div>
        );
      })}

      {/* Plus More Bubble */}
      {plusMoreCount > 0 && (() => {
        const i = displayUsers.length;
        const angle = (i * 2 * Math.PI) / (displayUsers.length + 1) - Math.PI / 2;
        const x = RADIUS * Math.cos(angle);
        const y = RADIUS * Math.sin(angle);
        return (
          <div 
            className="bubble bubble-plus-more"
            style={{
              width: '55px',
              height: '55px',
              transform: `translate(${x}px, ${y}px)`
            }}
          >
            +{plusMoreCount}
          </div>
        );
      })()}

      {/* Center Bubble */}
      <div 
        className="bubble bubble-center"
        style={{
          width: `${CENTER_SIZE}px`,
          height: `${CENTER_SIZE}px`,
          zIndex: 100
        }}
      >
        <div className="bubble-name" style={{fontSize: '1.25rem', fontFamily: 'serif'}}>{centerUser.username}</div>
        <div className="bubble-amount" style={{fontFamily: 'serif'}}>{fmt(centerUser.balance)}</div>
        <div className="bubble-label">{getLabel(centerUser.balance)}</div>
      </div>
    </div>
  );
};

export default BubbleChart;
