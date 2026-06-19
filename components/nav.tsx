"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectButton } from "./connect-button";

const LINKS = [
  { href: "/services", label: "Marketplace" },
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
    <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-mint shadow-glow">
      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/90" />
    </span>
  );
}