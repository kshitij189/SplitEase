import React from 'react';

const Logo = ({ size = 32, color = '#3b82f6', showText = true, className = "" }) => {
  return (
    <div className={`brand-logo ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        style={{ color: color }}
      >
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      {showText && (
        <span className="logo-text">
          Split<span>Ease</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
