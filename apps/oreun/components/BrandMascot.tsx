export default function BrandMascot({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="로블잼 블록 마스코트">
      <defs>
        <linearGradient id="cap" x1="0" x2="1"><stop stopColor="#37c8ff"/><stop offset="1" stopColor="#5368ff"/></linearGradient>
        <linearGradient id="hood" x1="0" x2="1"><stop stopColor="#5c7cff"/><stop offset="1" stopColor="#28b7ff"/></linearGradient>
      </defs>
      <rect x="10" y="20" width="42" height="34" rx="12" fill="#ffc978"/>
      <rect x="14" y="36" width="36" height="22" rx="10" fill="url(#hood)"/>
      <path d="M13 20c4-11 12-15 22-15 11 0 18 5 22 14-8-4-15-5-22-5-8 0-15 2-22 6Z" fill="url(#cap)"/>
      <rect x="26" y="5" width="22" height="8" rx="4" fill="#23325f"/>
      <circle cx="24" cy="31" r="2.3" fill="#17213a"/>
      <circle cx="40" cy="31" r="2.3" fill="#17213a"/>
      <path d="M25 40c4 4 10 4 14 0" fill="none" stroke="#17213a" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M13 39 5 34 3 39l10 8Z" fill="#ffc978"/>
      <path d="m46 45 8-11 6 4-8 12Z" fill="#ffc978"/>
      <rect x="27" y="46" width="10" height="8" rx="3" fill="#f4f8ff"/>
      <circle cx="30" cy="49" r="1" fill="#26365e"/><circle cx="34" cy="49" r="1" fill="#26365e"/>
    </svg>
  );
}
