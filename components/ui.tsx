"use client";

import { useState } from "react";

export function Stars({ value = 0 }: { value?: number }) {
  return (
    <span className="text-amber" title={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? "" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function CategoryPill({ category }: { category: string }) {
  return <span className="badge capitalize">{category.replace("-", " ")}</span>;
}

/** Green "verified" pill for endpoints that passed a live 402 health-check. */
export function VerifiedBadge({
  verified,
  hosted,
}: {
  verified?: boolean;
  hosted?: "seller" | "auragate";
}) {
  if (verified) {
    return (
      <span className="badge !border-mint/40 !text-mint" title="Endpoint returned a valid x402 challenge">
        <span className="h-1.5 w-1.5 rounded-full bg-mint" />
        Verified{hosted === "seller" ? " · seller-hosted" : ""}
      </span>
    );
  }
  return (
    <span className="badge !border-amber/40 !text-amber" title="Endpoint did not return a 402 challenge at registration">
      <span className="h-1.5 w-1.5 rounded-full bg-amber" />
      Unverified
    </span>
  );
}

/** 0–100 reputation meter. */
export function ReputationBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const tone = pct >= 70 ? "bg-mint" : pct >= 40 ? "bg-primary" : "bg-amber";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-ink">{pct}</span>
    </div>
  );
}

/** Click-to-copy chip used for addresses, endpoints and curl snippets. */
export function CopyButton({
  text,
  label,
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 text-xs text-muted transition hover:text-ink ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
      title="Copy to clipboard"
    >
      {copied ? (
        <span className="text-mint">✓ copied</span>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" />
          </svg>
          {label ?? "copy"}
        </>
      )}
    </button>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-line/60 ${className}`} />;
}
