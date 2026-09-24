export default function BrandMascot({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 128" role="img" aria-label="로블잼 블록 마스코트">
      <defs>
        <linearGradient id="rj-cap" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#35D8FF"/><stop offset=".52" stopColor="#2978FF"/><stop offset="1" stopColor="#4349D8"/></linearGradient>
        <linearGradient id="rj-hood" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#32BFFF"/><stop offset=".45" stopColor="#2F6FFF"/><stop offset="1" stopColor="#313ECC"/></linearGradient>
        <linearGradient id="rj-skin" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#FFE0A2"/><stop offset="1" stopColor="#F4A85D"/></linearGradient>
        <linearGradient id="rj-hair" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5D321E"/><stop offset="1" stopColor="#241713"/></linearGradient>
      </defs>
      <ellipse cx="65" cy="118" rx="39" ry="7" fill="#09132A" opacity=".45"/>
      <path d="M31 77c5-18 18-27 34-27 18 0 32 10 37 30l-5 37H34Z" fill="url(#rj-hood)"/>
      <path d="M38 87c-13 2-23 11-28 24l14 7 18-21Z" fill="#347BFF"/>
      <path d="M94 85c13-4 23-1 30 8l-8 12-20-8Z" fill="#2D67ED"/>
      <path d="M13 109c-3 4-2 9 2 12 5 3 10 1 13-4l-4-9Z" fill="url(#rj-skin)"/>
      <path d="M116 91c5-2 10 0 12 5 2 5-1 10-6 12l-8-5Z" fill="url(#rj-skin)"/>
      <rect x="41" y="28" width="49" height="50" rx="21" fill="url(#rj-skin)"/>
      <path d="M39 42c5-16 17-22 29-22 12 0 23 5 30 15-7-4-12-5-17-5l-7 8-8-6-8 7-7-5-12 8Z" fill="url(#rj-hair)"/>
      <path d="M36 34c5-17 17-25 32-25 16 0 29 8 36 24-13-5-25-7-36-7-11 0-21 3-32 8Z" fill="url(#rj-cap)"/>
      <path d="M51 9c8-5 20-6 30-2l4 11H49Z" fill="#193268"/>
      <path d="M62 11l8 0 5 10H58Z" fill="#D9FF58"/>
      <path d="M40 35c-8-1-13 4-13 13v13c0 6 4 10 10 10h5V37Z" fill="#19275C"/>
      <path d="M91 35c8-1 13 4 13 13v13c0 6-4 10-10 10h-5V37Z" fill="#19275C"/>
      <rect x="29" y="42" width="11" height="23" rx="5" fill="#4ED7FF"/>
      <rect x="91" y="42" width="11" height="23" rx="5" fill="#4ED7FF"/>
      <circle cx="55" cy="52" r="3" fill="#172033"/>
      <circle cx="78" cy="52" r="3" fill="#172033"/>
      <circle cx="54" cy="51" r="1" fill="#fff"/>
      <circle cx="77" cy="51" r="1" fill="#fff"/>
      <path d="M55 63c6 7 16 7 22 0" fill="#fff" stroke="#20243A" strokeWidth="3" strokeLinecap="round"/>
      <path d="M46 82c6 8 13 12 20 12 8 0 15-4 22-12" fill="none" stroke="#8DDCFF" strokeWidth="4" strokeLinecap="round"/>
      <rect x="52" y="91" width="28" height="19" rx="6" fill="#F5F7FF"/>
      <path d="M58 100h7m-3.5-3.5v7" stroke="#263765" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="72" cy="98" r="1.8" fill="#263765"/><circle cx="76" cy="102" r="1.8" fill="#263765"/>
      <path d="M95 18l4 6 7 1-5 5 1 7-7-4-6 4 1-7-5-5 7-1Z" fill="#D9FF58"/>
    </svg>
  );
}
