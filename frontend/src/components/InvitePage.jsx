import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Logo from './Logo';
import '../styles/invite.css';

const InvitePage = ({ user, onAuthSuccess }) => {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [groupInfo, setGroupInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchInviteInfo();
  }, [inviteCode]);

  const fetchInviteInfo = async () => {
    try {
      const response = await axios.get(`/invite/${inviteCode}`);
      setGroupInfo(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired invite link.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (memberId, memberName) => {
    if (!user) return;
    setClaiming(true);
    setError('');

    try {
      const response = await axios.post(`/invite/${inviteCode}/claim`, {
        member_id: memberId,
      });
      setSuccess(`You've joined "${groupInfo.group_name}" as ${user.username}, replacing ${memberName}!`);
      setTimeout(() => {
        navigate(`/groups/${response.data.group.id}`);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to claim member.');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="invite-container">
        <div className="invite-card">
          <div className="invite-loading">Loading invite...</div>
        </div>
      </div>
    );
  }

  if (error && !groupInfo) {
    return (
      <div className="invite-container">
        <div className="invite-blob invite-blob-1"></div>
        <div className="invite-blob invite-blob-2"></div>
        <div className="invite-card">
          <Logo size={44} />
          <h1>Invalid Invite</h1>
          <p className="invite-error-msg">{error}</p>
          <Link to="/" className="invite-home-btn">Go Home</Link>
        </div>
      </div>
    );
  }

  // Not logged in — prompt to sign up / log in
  if (!user) {
    return (
      <div className="invite-container">
        <div className="invite-blob invite-blob-1"></div>
        <div className="invite-blob invite-blob-2"></div>
        <div className="invite-card">
          <div className="invite-logo">
            <Logo size={44} />
          </div>
          <h1>You're Invited!</h1>
          <p className="invite-subtitle">
            Join <strong>{groupInfo.group_name}</strong> on SplitEase
          </p>

          <div className="invite-group-preview">
            <div className="preview-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <span>{groupInfo.members.length} members</span>
          </div>

          <div className="invite-auth-actions">
            <Link to={`/signup?invite=${inviteCode}`} className="invite-btn-primary">
              Sign Up to Join
            </Link>
            <Link to={`/login?invite=${inviteCode}`} className="invite-btn-secondary">
              Already have an account? Log In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Logged in — show members to claim
  const dummyMembers = groupInfo.members.filter(m => m.is_dummy);
  const isAlreadyMember = groupInfo.members.some(m => m.id === user.id);

  return (
    <div className="invite-container">
      <div className="invite-blob invite-blob-1"></div>
      <div className="invite-blob invite-blob-2"></div>
      <div className="invite-card invite-card-wide">
        <div className="invite-logo">
          <Logo size={44} />
        </div>
        <h1>Join {groupInfo.group_name}</h1>

        {success && <div className="invite-success">{success}</div>}
        {error && <div className="invite-error">{error}</div>}

        {isAlreadyMember ? (
          <div className="invite-already-member">
            <p>You're already a member of this group!</p>
            <button onClick={() => navigate(`/groups/${groupInfo.group_id}`)} className="invite-btn-primary">
              Go to Group
            </button>
          </div>
        ) : dummyMembers.length === 0 ? (
          <div className="invite-no-slots">
            <p>All members in this group already have accounts. No spots available to claim.</p>
            <Link to="/groups" className="invite-btn-primary">Go to Dashboard</Link>
          </div>
        ) : (
          <>
            <p className="invite-subtitle">Which member are you? Select yourself to claim your spot.</p>
            <div className="claim-members-grid">
              {dummyMembers.map((member) => (
                <button
                  key={member.id}
                  className="claim-member-card"
                  onClick={() => handleClaim(member.id, member.username)}
                  disabled={claiming}
                >
                  <div className="claim-avatar">
                    {member.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="claim-name">{member.username}</span>
                  <span className="claim-action">
                    {claiming ? 'Joining...' : "I'm this person"}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
