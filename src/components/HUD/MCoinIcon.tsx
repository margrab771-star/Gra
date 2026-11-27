import React from 'react';

interface MCoinIconProps {
  size?: number;
  className?: string;
}

/** Wektorowa ikona Złotej Monety „M” (waluta progresji Market Dominion) */
export const MCoinIcon: React.FC<MCoinIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 align-middle ${className}`}
    aria-label="Moneta M"
  >
    <defs>
      <radialGradient id="mcoin-face" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="45%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </radialGradient>
      <linearGradient id="mcoin-rim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="50%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#92400e" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10.75" fill="url(#mcoin-rim)" />
    <circle cx="12" cy="12" r="8.8" fill="url(#mcoin-face)" stroke="#fef9c3" strokeOpacity="0.65" strokeWidth="0.9" />
    <circle cx="12" cy="12" r="7.2" fill="none" stroke="#92400e" strokeOpacity="0.4" strokeWidth="0.7" />
    <path
      d="M7.2 16.5V7.5H9.65L12 12.25L14.35 7.5H16.8V16.5H14.7V11.35L12.7 15.25H11.3L9.3 11.35V16.5H7.2Z"
      fill="#451a03"
      stroke="#fef9c3"
      strokeOpacity="0.35"
      strokeWidth="0.3"
    />
  </svg>
);
