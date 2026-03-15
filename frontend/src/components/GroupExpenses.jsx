import React, { useState } from 'react';
import Expense from './Expense';
import AddExpense from './AddExpense';
import '../styles/group_expenses.css';

function GroupExpenses({ user, users, expenses, groupId, onShowChat, onAddExpense, onDeleteExpense, onEditExpense }) {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingExpense(null);
  };

  const handleSubmit = (data) => {
    if (editingExpense) {
      onEditExpense(editingExpense.id, data);
    } else {
      onAddExpense(data);
    }
  };

  return (
    <div className="expenses-panel">
      <div className="panel-top">
        <div>
          <h2 className="panel-heading">Expenses</h2>
          <p className="panel-sub">Track all shared spending</p>
        </div>
        <div className="btn-group">
          <button className="btn-bot" onClick={onShowChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Ask SplitBot
          </button>
          <button className="btn-add-expense" onClick={() => setShowForm(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Expense
          </button>
        </div>
      </div>



      <div className="expenses-scroll">
        {expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <p>No expenses yet</p>
            <span>Click "Add Expense" to get started</span>
          </div>
        ) : (
          expenses.map(expense => (
            <Expense
              key={expense.id}
              user={user}
              expense={expense}
              onDelete={onDeleteExpense}
              onEdit={handleEdit}
            />
          ))
        )}
      </div>

      {showForm && (
        <AddExpense
          users={users}
          onAddExpense={handleSubmit}
          onClose={handleClose}
          editingExpense={editingExpense}
        />
      )}
    </div>
  );
}

export default GroupExpenses;
