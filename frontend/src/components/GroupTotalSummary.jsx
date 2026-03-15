import React from 'react';
import '../styles/summary.css';

/**
 * Summary card showing total spent across all expenses.
 * Matching the design from the user's first image.
 */
function GroupTotalSummary({ expenses, onClick }) {
  const totalCents = expenses.reduce((s, e) => s + e.amount, 0);
  const totalFmt = '₹' + (totalCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const count = expenses.length;

  return (
    <div className="summary-card" onClick={onClick}>
      <div className="summary-card-title">Total spent</div>
      <div className="summary-card-bottom">
        <div className="summary-left-group">

          <div className="summary-icon-circle">$</div>
          <div className="summary-expense-count">{count} expenses</div>
        </div>
        <div className="summary-total-amt">{totalFmt}</div>
      </div>
    </div>
  );
}

export default GroupTotalSummary;
