import React, { useState } from 'react';
import '../styles/add_user.css';

function AddUser({ onAddUser }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');

  const submit = () => {
    if (!open) { setOpen(true); return; }
    if (username.trim()) {
      onAddUser(username.trim());
      setUsername('');
      setOpen(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') { setOpen(false); setUsername(''); }
  };

  return (
    <div className="add-user">
      {open && (
        <input
          className="add-user-field"
          placeholder="Username..."
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={onKey}
          autoFocus
        />
      )}
      <button className="add-user-trigger" onClick={submit} title="Add member">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  );
}

export default AddUser;
