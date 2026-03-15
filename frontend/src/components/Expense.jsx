import React, { useState } from 'react';
import axios from 'axios';
import '../styles/expense.css';



function Expense({ user, expense, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(expense.comments || []);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const formatAmount = (cents) => '₹' + (cents / 100).toFixed(2);
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const isSettlement = expense.title.startsWith('Settlement:');


  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(expense.id);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(expense);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      const res = await axios.post(`/groups/${expense.group}/expenses/${expense.id}/comments`, { text: commentText });
      // If the backend returns all comments (array), replace the state. Otherwise append.
      if (Array.isArray(res.data)) {
        setComments(res.data);
      } else {
        setComments([...comments, res.data]);
      }
      setCommentText('');
    } catch (err) {
      console.error('Failed to add comment', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      const res = await axios.delete(`/groups/${expense.group}/expenses/${expense.id}/comments/${commentId}`);
      if (Array.isArray(res.data)) {
        setComments(res.data);
      } else {
        setComments(comments.filter(c => c.id !== commentId));
      }
    } catch (err) {
      console.error('Failed to delete comment', err);
      alert(err.response?.data || "Failed to delete comment");
    }
  };

  return (
    <div className={`exp-card ${expanded ? 'exp-card--open' : ''}`} onClick={() => setExpanded(!expanded)}>
      <div className="exp-row">
        <div className="exp-left">
          <div className="exp-avatar-main" title={`Paid by ${expense.lender}`}>
            {expense.lender ? expense.lender.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <div className="exp-title">{expense.title}</div>
            <div className="exp-sub">
              <span className="exp-lender">
                {expense.lenders && expense.lenders.length > 1 
                  ? `${expense.lenders.length} people` 
                  : expense.lender}
              </span> paid · {formatDate(expense.created_at)}
            </div>
          </div>
        </div>
        <div className="exp-right">
          <div className="exp-amt">{formatAmount(expense.amount)}</div>
          <svg className={`exp-chevron ${expanded ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {expanded && (
        <div className="exp-detail">
          {/* Payers breakdown (if multiple) */}
          {expense.lenders && expense.lenders.length > 1 && (
            <>
              <div className="exp-detail-label">Paid by</div>
              {expense.lenders.map((l, i) => (
                <div key={`lender-${i}`} className="exp-detail-item lender-item">
                  <div className="exp-detail-avatar" style={{background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80'}}>
                    {l.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="exp-detail-name">{l.username}</span>
                  <span className="exp-detail-amt">{formatAmount(l.amount)}</span>
                </div>
              ))}
              <div style={{height: '12px'}} />
            </>
          )}

          <div className="exp-detail-label">Split breakdown</div>
          {expense.borrowers.map((b, i) => (
            <div key={i} className="exp-detail-item">
              <div className="exp-detail-avatar">{b.username.charAt(0).toUpperCase()}</div>
              <span className="exp-detail-name">{b.username}</span>
              <span className="exp-detail-amt">{formatAmount(b.amount)}</span>
            </div>
          ))}
          {!isSettlement && (
            <div className="exp-actions">
              <button className="exp-action-btn exp-edit-btn" onClick={handleEdit}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              <button className="exp-action-btn exp-delete-btn" onClick={handleDelete}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
            </div>
          )}

          {/* Comments Section */}
          {!isSettlement && (
            <div className="exp-comments-section" onClick={(e) => e.stopPropagation()}>
              <div className="exp-detail-label">Comments</div>
              {comments.length === 0 ? (
                <div className="exp-no-comments">No comments yet.</div>
              ) : (
                <div className="exp-comments-list">
                  {comments.map((c, i) => {
                    const isBot = c.author === 'SplitBot';
                    return (
                      <div key={i} className={`exp-comment-item ${isBot ? 'bot-comment' : ''}`}>
                        <div className="exp-comment-header">
                          <div className={`exp-comment-avatar ${isBot ? 'bot-avatar' : ''}`}>
                            {c.author.charAt(0).toUpperCase()}
                          </div>
                          <div className="exp-comment-author">{c.author}</div>
                        </div>
                        <div className="exp-comment-text">{c.text}</div>
                        <div className="exp-comment-footer">
                          <div className="exp-comment-time">{formatDate(c.created_at)}</div>
                          {user && user.username === c.author && (
                            <button 
                              className="exp-comment-delete-btn" 
                              onClick={() => handleDeleteComment(c.id)}
                              title="Delete comment"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <form className="exp-comment-form" onSubmit={handleAddComment}>
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  disabled={isSubmittingComment}
                />
                <button type="submit" disabled={isSubmittingComment || !commentText.trim()}>
                  Post
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Expense;
