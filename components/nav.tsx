"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectButton } from "./connect-button";

const LINKS = [
  { href: "/services", label: "Registry" },
  { href: "/sellers", label: "Sellers" },
  { href: "/dashboard", label: "Seller" },
  { href: "/receipts", label: "Receipts" },
  { href: "/playground", label: "Agent" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/70 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <Logo />
          <span className="text-lg font-bold tracking-tight">Aura<span className="gradient-text">Gate</span></span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "text-ink" : "text-muted hover:text-ink"}`}>{l.label}</Link>;
          })}
        </nav>
        <div className="hidden md:block"><ConnectButton /></div>
        <button className="btn-ghost !px-3 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-bg2 md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-panel hover:text-ink">{l.label}</Link>)}
            <div className="px-1 pt-2"><ConnectButton /></div>
          </div>
        </div>
      )}
    </header>
  );
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="navAg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="42%" stopColor="#00CBB8" />
          <stop offset="72%" stopColor="#3E73FF" />
          <stop offset="100%" stopColor="#8A4DFF" />
        </linearGradient>
        <linearGradient id="navRail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.15" />
          <stop offset="28%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#3E73FF" />
        </linearGradient>
      </defs>
      {/* payment rail */}
      <line x1="105" y1="570" x2="920" y2="570" stroke="url(#navRail)" strokeWidth="16" strokeLinecap="round" opacity="0.22" />
      <line x1="105" y1="570" x2="920" y2="570" stroke="#00F0FF" strokeWidth="5" strokeLinecap="round" />
      <circle cx="885" cy="570" r="31" fill="#06122B" stroke="#00F0FF" strokeWidth="7" />
      <circle cx="885" cy="570" r="7" fill="#00F0FF" />
      {/* A-gate symbol */}
      <path
        fillRule="evenodd"
        d="M512 112 C552 112 585 135 604 176 L843 703 C854 729 835 758 806 758 H682 L615 606 V516 C615 458 569 412 512 412 C455 412 409 458 409 516 V606 L342 758 H218 C189 758 170 729 181 703 L420 176 C439 135 472 112 512 112 Z M512 380 C431 380 365 445 365 526 V766 H659 V526 C659 445 593 380 512 380 Z"
        fill="url(#navAg)"
      />
    </svg>
  );
}