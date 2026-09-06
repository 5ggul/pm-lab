import Link from "next/link";

export function TopNav() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">R</span>
          <span className="brand-copy">
            <span className="brand-title">Resonance Radar</span>
            <span className="brand-sub">smart money convergence</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Primary">
          <Link href="/">Radar</Link>
          <Link href="/traders">Traders</Link>
          <Link href="/admin">Admin</Link>
          <a href="https://github.com/5ggul/pm-lab" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </header>
  );
}
