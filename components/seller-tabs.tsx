"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", hint: "Revenue & activity" },
  { href: "/sell", label: "Sell an API", icon: "➕", hint: "List a new service" },
  { href: "/profile", label: "Profile", icon: "👤", hint: "Your wallet & listings" },
];

/** Shared sub-navigation across the three seller surfaces. */
export function SellerTabs() {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <div className="mb-8 flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-panel/40 p-1.5">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          title={t.hint}
          className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            isActive(t.href)
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:bg-panel2/60 hover:text-ink"
          }`}
        >
          <span className="text-base leading-none">{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
