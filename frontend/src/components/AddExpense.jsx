import React, { useState, useEffect } from 'react';
import '../styles/add_expense.css';

const SPLIT_MODES = [
  { key: 'equal', label: 'Equal' },
  { key: 'exact', label: 'Exact' },
  { key: 'percentage', label: '%' },
  { key: 'shares', label: 'Shares' },
];

function AddExpense({ users, onAddExpense, onClose, editingExpense }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [lender, setLender] = useState('');
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [payers, setPayers] = useState([
    { id: Math.random() * 1000, username: '', amount: '' }
  ]);
  const [splitMode, setSplitMode] = useState('equal');
  const [borrowers, setBorrowers] = useState([
    { id: Math.random() * 1000, username: '', amount: '', value: '' }
  ]);

  // Pre-fill when editing
  useEffect(() => {
    if (editingExpense) {
      setTitle(editingExpense.title);
      setAmount((editingExpense.amount / 100).toFixed(2));
      setLender(editingExpense.lender);
      
      if (editingExpense.lenders && editingExpense.lenders.length > 1) {
        setIsMultiPayer(true);
        setPayers(editingExpense.lenders.map(l => ({
          id: Math.random() * 1000,
          username: l.username,
          amount: (l.amount / 100).toFixed(2)
        })));
      } else {
        setIsMultiPayer(false);
        setLender(editingExpense.lender);
      }

      setSplitMode('exact');
      setBorrowers(
        editingExpense.borrowers.map(b => ({
          id: Math.random() * 1000,
          username: b.username,
          amount: (b.amount / 100).toFixed(2),
          value: (b.amount / 100).toFixed(2)
        }))
      );
    }
  }, [editingExpense]);

  // Auto-calculate amounts based on split mode
  useEffect(() => {
    if (!amount || splitMode === 'exact') return;
    const totalCents = Math.round(parseFloat(amount) * 100);
    const activeBorrowers = borrowers.filter(b => b.username);
    const count = activeBorrowers.length;
    if (count === 0) return;

    if (splitMode === 'equal') {
      const perPerson = Math.floor(totalCents / count);
      let remainder = totalCents - (perPerson * count);
      const updated = borrowers.map(b => {
        if (!b.username) return { ...b, amount: '', value: '' };
        let share = perPerson;
        if (remainder > 0) { share += 1; remainder -= 1; }
        return { ...b, amount: (share / 100).toFixed(2), value: '' };
      });
      setBorrowers(updated);
    } else if (splitMode === 'percentage') {
      const updated = borrowers.map(b => {
        if (!b.username || !b.value) return { ...b, amount: '' };
        const pct = parseFloat(b.value) || 0;
        const share = Math.round(totalCents * pct / 100);
        return { ...b, amount: (share / 100).toFixed(2) };
      });
      setBorrowers(updated);
    } else if (splitMode === 'shares') {
      const totalShares = activeBorrowers.reduce((s, b) => s + (parseFloat(b.value) || 0), 0);
      if (totalShares <= 0) return;
      let distributed = 0;
      const updated = borrowers.map((b, i) => {
        if (!b.username || !b.value) return { ...b, amount: '' };
        const shareCount = parseFloat(b.value) || 0;
        const share = Math.round(totalCents * shareCount / totalShares);
        distributed += share;
        return { ...b, amount: (share / 100).toFixed(2) };
      });
      // Fix rounding: adjust last active borrower
      const diff = totalCents - distributed;
      if (diff !== 0) {
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].username && updated[i].amount) {
            const current = Math.round(parseFloat(updated[i].amount) * 100);
            updated[i].amount = ((current + diff) / 100).toFixed(2);
            break;
          }
        }
      }
      setBorrowers(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, splitMode, borrowers.map(b => b.username + ':' + b.value + ':' + b.amount).join(',')]);

  const addRow = () => setBorrowers([...borrowers, { id: Math.random() * 1000, username: '', amount: '', value: '' }]);
  const removeRow = (id) => { if (borrowers.length > 1) setBorrowers(borrowers.filter(b => b.id !== id)); };

  const addPayerRow = () => setPayers([...payers, { id: Math.random() * 1000, username: '', amount: '' }]);
  const removePayerRow = (id) => { if (payers.length > 1) setPayers(payers.filter(p => p.id !== id)); };

  const update = (id, field, val) => {
    setBorrowers(borrowers.map(b => {
      if (b.id !== id) return b;
      if (field === 'amount' && splitMode === 'exact') {
        return { ...b, amount: val, value: val };
      }
      if (field === 'value') {
        return { ...b, value: val };
      }
      return { ...b, [field]: val };
    }));
  };

  const updatePayer = (id, field, val) => {
    setPayers(payers.map(p => (p.id === id ? { ...p, [field]: val } : p)));
  };

  const addAll = () => {
    setBorrowers(users.map(u => ({ id: Math.random() * 1000, username: u.username, amount: '', value: '' })));
  };

  const handleSplitModeChange = (newMode) => {
    if (newMode === splitMode) return;

    if (newMode === 'percentage') {
      const activeBorrowers = borrowers.filter(b => b.username);
      if (activeBorrowers.length > 0) {
        let updated;
        if (splitMode === 'shares') {
          const totalShares = activeBorrowers.reduce((s, b) => s + (parseFloat(b.value) || 0), 0);
          if (totalShares > 0) {
            let distributed = 0;
            updated = borrowers.map(b => {
              if (!b.username) return b;
              const shareCount = parseFloat(b.value) || 0;
              const pct = parseFloat(((shareCount / totalShares) * 100).toFixed(1));
              distributed += pct;
              return { ...b, value: pct.toFixed(1) };
            });
            const diff = 100 - distributed;
            if (Math.abs(diff) > 0.01) {
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].username && updated[i].value) {
                  updated[i].value = (parseFloat(updated[i].value) + diff).toFixed(1);
                  break;
                }
              }
            }
          }
        } else if (splitMode === 'equal') {
          const perPerson = parseFloat((100 / activeBorrowers.length).toFixed(1));
          let distributed = perPerson * activeBorrowers.length;
          updated = borrowers.map(b => ({ ...b, value: b.username ? perPerson.toFixed(1) : '' }));
          const diff = 100 - distributed;
          if (Math.abs(diff) > 0.01) {
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].username && updated[i].value) {
                updated[i].value = (parseFloat(updated[i].value) + diff).toFixed(1);
                break;
              }
            }
          }
        }
        if (updated) setBorrowers(updated);
      }
    } else if (newMode === 'shares') {
      if (splitMode === 'equal') {
        setBorrowers(borrowers.map(b => ({ ...b, value: b.username ? '1' : '' })));
      } else if (splitMode === 'percentage') {
        const activeBorrowers = borrowers.filter(b => b.username);
        setBorrowers(borrowers.map(b => ({ ...b, value: b.value || (b.username ? '1' : '') })));
      }
    } else if (newMode === 'exact') {
      setBorrowers(borrowers.map(b => ({ ...b, value: b.amount || '' })));
    }

    setSplitMode(newMode);
  };

  const valid = () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) return false;
    
    const tc = Math.round(parseFloat(amount) * 100);

    // Validate Payers
    if (isMultiPayer) {
      const vp = payers.filter(p => p.username && p.amount);
      if (vp.length === 0) return false;
      const pt = vp.reduce((s, p) => s + Math.round(parseFloat(p.amount) * 100), 0);
      if (pt !== tc) return false;
    } else {
      if (!lender) return false;
    }

    // Validate Borrowers
    const vb = borrowers.filter(b => b.username && b.amount);
    if (vb.length === 0) return false;
    return vb.reduce((s, b) => s + Math.round(parseFloat(b.amount) * 100), 0) === tc;
  };

  const submit = () => {
    if (!valid()) return;
    const tc = Math.round(parseFloat(amount) * 100);

    let finalLenders = [];
    if (isMultiPayer) {
      finalLenders = payers.filter(p => p.username && p.amount).map(p => [p.username, Math.round(parseFloat(p.amount) * 100)]);
    } else {
      finalLenders = [[lender, tc]];
    }

    onAddExpense({
      title,
      author: lender || finalLenders[0][0], // use first lender as fallback author
      lender: lender || finalLenders[0][0],
      lenders: finalLenders,
      borrowers: borrowers.filter(b => b.username && b.amount).map(b => [b.username, Math.round(parseFloat(b.amount) * 100)]),
      amount: tc
    });
    onClose();
  };

  // Helper text for split mode
  const getInputLabel = () => {
    switch (splitMode) {
      case 'percentage': return '%';
      case 'shares': return 'x';
      default: return '₹';
    }
  };

  const getPlaceholder = () => {
    switch (splitMode) {
      case 'percentage': return '0';
      case 'shares': return '1';
      default: return '0.00';
    }
  };

  // Summary for percentage/shares/exact
  const getSplitSummary = () => {
    if (splitMode === 'percentage') {
      const total = borrowers.filter(b => b.username && b.value).reduce((s, b) => s + (parseFloat(b.value) || 0), 0);
      const isValid = Math.abs(total - 100) < 0.01;
      return <span className={`split-summary ${isValid ? 'valid' : 'invalid'}`}>{total.toFixed(1)}% of 100%</span>;
    }
    if (splitMode === 'shares') {
      const total = borrowers.filter(b => b.username && b.value).reduce((s, b) => s + (parseFloat(b.value) || 0), 0);
      return <span className="split-summary">{total} total shares</span>;
    }
    return null;
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h2>{editingExpense ? 'Edit Expense' : 'New Expense'}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="field-row">
            <div className="field flex-2">
              <label>What's it for?</label>
              <input type="text" placeholder="Dinner, Groceries..." value={title} onChange={e => setTitle(e.target.value)} maxLength={50} />
            </div>
            <div className="field flex-1">
              <label>Amount ({'\u20B9'})</label>
              <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" />
            </div>
          </div>

          <div className="field">
            <div className="label-with-toggle">
              <label>Paid by</label>
              <div className="multi-toggle" onClick={() => setIsMultiPayer(!isMultiPayer)}>
                <div className={`toggle-track ${isMultiPayer ? 'active' : ''}`}>
                  <div className="toggle-thumb" />
                </div>
                <span>Multiple payers</span>
              </div>
            </div>
            
            {!isMultiPayer ? (
              <select value={lender} onChange={e => setLender(e.target.value)}>
                <option value="">Select who paid...</option>
                {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
              </select>
            ) : (
              <div className="payer-list">
                {payers.map((p, i) => (
                  <div key={p.id} className="b-row p-row">
                    <select value={p.username} onChange={e => updatePayer(p.id, 'username', e.target.value)}>
                      <option value="">Select member</option>
                      {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                    </select>
                    <div className="b-amt-wrap">
                      <span>₹</span>
                      <input type="number" placeholder="0.00" value={p.amount} onChange={e => updatePayer(p.id, 'amount', e.target.value)} min="0" step="0.01" />
                    </div>
                    {payers.length > 1 && (
                      <button className="b-btn b-remove" onClick={() => removePayerRow(p.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    )}
                    {i === payers.length - 1 && (
                      <button className="b-btn b-add" onClick={addPayerRow}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    )}
                  </div>
                ))}
                {isMultiPayer && amount > 0 && (
                  <div className="split-summary-row">
                    <span className={`split-summary ${Math.abs(payers.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) - parseFloat(amount)) < 0.01 ? 'valid' : 'invalid'}`}>
                      Total: ₹{payers.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toFixed(2)} of ₹{parseFloat(amount).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="split-head">
            <div className="split-mode-pills">
              {SPLIT_MODES.map(m => (
                <button
                  key={m.key}
                  className={`split-pill ${splitMode === m.key ? 'active' : ''}`}
                  onClick={() => handleSplitModeChange(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="split-head-right">
              {getSplitSummary()}
              <button className="btn-add-all" onClick={addAll}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>
                Add All
              </button>
            </div>
          </div>

          <div className="borrower-list">
            {borrowers.map((b, i) => (
              <div key={b.id} className="b-row">
                <select value={b.username} onChange={e => update(b.id, 'username', e.target.value)}>
                  <option value="">Select member</option>
                  {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                </select>
                <div className="b-amt-wrap">
                  <span>{getInputLabel()}</span>
                  {splitMode === 'equal' ? (
                    <input type="number" placeholder="0.00" value={b.amount} disabled />
                  ) : splitMode === 'exact' ? (
                    <input type="number" placeholder="0.00" value={b.amount} onChange={e => update(b.id, 'amount', e.target.value)} min="0" step="0.01" />
                  ) : (
                    <input type="number" placeholder={getPlaceholder()} value={b.value} onChange={e => update(b.id, 'value', e.target.value)} min="0" step={splitMode === 'shares' ? '1' : '0.1'} />
                  )}
                </div>
                {(splitMode === 'percentage' || splitMode === 'shares') && b.amount && (
                  <span className="b-calc-amt">₹{b.amount}</span>
                )}
                {borrowers.length > 1 && (
                  <button className="b-btn b-remove" onClick={() => removeRow(b.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
                {i === borrowers.length - 1 && (
                  <button className="b-btn b-add" onClick={addRow}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!valid()}>
            {editingExpense ? 'Save Changes' : 'Confirm Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddExpense;
