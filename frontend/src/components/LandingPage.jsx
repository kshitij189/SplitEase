import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import '../styles/landing.css';

const LandingPage = ({ user }) => {
  return (
    <div className="landing-container">
      {/* Background Decorations */}
      <div className="landing-bg-wrapper">
        <div className="landing-blur-1"></div>
        <div className="landing-blur-2"></div>
      </div>

      <nav className="landing-nav">
        <Logo />
        <div className="nav-actions">
          {user ? (
            <Link to="/groups" className="btn-nav-primary">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/signup" className="btn-nav-primary">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      <header className="hero">
        <div className="hero-badge">
          <span>New</span> Meet SplitBot, your AI accountant 🤖
        </div>
        <h1>The smartest way to <br /><span>split expenses.</span></h1>
        <p>
          Say goodbye to spreadsheet stress. Track bills, settle debts, and chat with AI to stay on top of your group finances.
        </p>
        <div className="hero-btns">
          <Link to={user ? "/groups" : "/signup"} className="btn-hero-primary">
            {user ? "Go to Dashboard" : "Start Splitting — It's Free"}
          </Link>
          <a href="#features" className="btn-hero-secondary">How it works</a>
        </div>
      </header>

      <section className="stats">
        <div className="stat-item">
          <span className="stat-value">100%</span>
          <span className="stat-label">Accurate</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">0</span>
          <span className="stat-label">Complex Math</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">24/7</span>
          <span className="stat-label">AI Support</span>
        </div>
      </section>

      <section id="features" className="features">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <h3>Smart Settlement</h3>
            <p>Our Greedy Algorithm minimizes transactions, making it easier for everyone to settle up with fewer steps.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
            <h3>SplitBot AI</h3>
            <p>Mention @SplitBot in comments to get instant insights, balance summaries, and settlement advice.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
            </div>
            <h3>Real-time Insights</h3>
            <p>Visualize debts with interactive bubble charts and track every cent with a detailed activity feed.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        &copy; {new Date().getFullYear()} SplitEase. Built for groups who value clarity.
      </footer>
    </div>
  );
};

export default LandingPage;
