import React from 'react';

const Logo = ({ size = 38, showText = true, className = "" }) => {
  return (
    <div className={`brand-logo ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{
        width: size,
        height: size,
        backgroundColor: '#22c55e',
        borderRadius: size * 0.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          color: '#ffffff',
          fontSize: size * 0.55,
          fontWeight: 800,
          lineHeight: 1,
        }}>$</span>
      </div>
      {showText && (
        <span className="logo-text">
          Split<span>Ease</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
