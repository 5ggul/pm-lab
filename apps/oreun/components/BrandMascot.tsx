export default function BrandMascot({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 180" role="img" aria-label="로블잼 블록 게임 마스코트">
      <defs>
        <linearGradient id="rj-blue-cap" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#39D8FF"/><stop offset=".42" stopColor="#2D7BFF"/><stop offset="1" stopColor="#2535B8"/>
        </linearGradient>
        <linearGradient id="rj-blue-hood" x1=".1" y1="0" x2=".9" y2="1">
          <stop stopColor="#39C9FF"/><stop offset=".5" stopColor="#246EF1"/><stop offset="1" stopColor="#2841C4"/>
        </linearGradient>
        <linearGradient id="rj-skin" x1=".15" y1=".05" x2=".9" y2=".95">
          <stop stopColor="#FFE7AE"/><stop offset=".55" stopColor="#FFC77B"/><stop offset="1" stopColor="#EE9652"/>
        </linearGradient>
        <linearGradient id="rj-hair" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#70412D"/><stop offset=".55" stopColor="#3D231B"/><stop offset="1" stopColor="#1B1313"/>
        </linearGradient>
        <filter id="rj-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#061631" floodOpacity=".45"/>
        </filter>
      </defs>

      <ellipse cx="91" cy="166" rx="54" ry="9" fill="#061631" opacity=".35"/>
      <g filter="url(#rj-shadow)">
        <path d="M51 108c9-20 24-30 43-30 24 0 41 13 47 38l-4 43H48Z" fill="url(#rj-blue-hood)" stroke="#17367B" strokeWidth="4"/>
        <path d="M54 119 34 106c-9-6-18-4-24 4-6 9-3 18 6 24l25 15Z" fill="#2D79FF" stroke="#17367B" strokeWidth="4"/>
        <rect x="3" y="108" width="28" height="35" rx="10" transform="rotate(-27 3 108)" fill="url(#rj-skin)" stroke="#D98746" strokeWidth="3"/>
        <path d="M132 118c15-4 27 0 35 12l-9 17-28-13Z" fill="#2F68E4" stroke="#17367B" strokeWidth="4"/>
        <rect x="150" y="122" width="27" height="34" rx="10" transform="rotate(21 150 122)" fill="url(#rj-skin)" stroke="#D98746" strokeWidth="3"/>

        <rect x="54" y="43" width="76" height="70" rx="29" fill="url(#rj-skin)" stroke="#D98746" strokeWidth="3"/>
        <path d="M53 60c8-24 28-32 45-30 18 2 31 11 38 26-10-5-18-7-26-7l-11 10-10-9-10 8-9-7-17 9Z" fill="url(#rj-hair)"/>

        <path d="M48 48C57 24 75 13 98 14c22 1 39 12 48 34-17-7-33-10-49-10-17 0-32 4-49 10Z" fill="url(#rj-blue-cap)" stroke="#183B8B" strokeWidth="4"/>
        <path d="M72 16c11-8 28-9 41-3l4 18H69Z" fill="#204591" stroke="#17367B" strokeWidth="3"/>
        <path d="m87 18 9-5 9 5v11H87Z" fill="#D9FF58"/>
        <path d="M101 39c18 0 33 3 47 9-13 2-28 3-44 2Z" fill="#1D58D9" stroke="#17367B" strokeWidth="3"/>

        <path d="M54 59c-12-2-20 5-20 17v17c0 10 6 15 15 15h8V61Z" fill="#182B67" stroke="#102251" strokeWidth="3"/>
        <path d="M130 59c12-2 20 5 20 17v17c0 10-6 15-15 15h-8V61Z" fill="#182B67" stroke="#102251" strokeWidth="3"/>
        <rect x="38" y="66" width="15" height="34" rx="7" fill="#56D9FF"/>
        <rect x="131" y="66" width="15" height="34" rx="7" fill="#56D9FF"/>

        <ellipse cx="78" cy="80" rx="5" ry="6" fill="#172033"/>
        <ellipse cx="109" cy="80" rx="5" ry="6" fill="#172033"/>
        <circle cx="76" cy="77" r="1.6" fill="#fff"/><circle cx="107" cy="77" r="1.6" fill="#fff"/>
        <path d="M76 92c9 12 26 12 35 0" fill="#fff" stroke="#222B45" strokeWidth="4" strokeLinecap="round"/>

        <path d="M65 121c8 9 18 14 29 14 12 0 22-5 31-15" fill="none" stroke="#8CEAFF" strokeWidth="5" strokeLinecap="round"/>
        <rect x="75" y="133" width="38" height="25" rx="7" fill="#F8FAFF" stroke="#B9C8EA" strokeWidth="2"/>
        <path d="M83 145h10m-5-5v10" stroke="#27406E" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="102" cy="143" r="2.4" fill="#27406E"/><circle cx="107" cy="149" r="2.4" fill="#27406E"/>
        <path d="M146 27l5 8 10 1-7 7 2 10-10-5-9 5 2-10-7-7 10-1Z" fill="#D9FF58" stroke="#90AE24" strokeWidth="2"/>
      </g>
    </svg>
  );
}
