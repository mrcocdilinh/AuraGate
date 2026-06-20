import { ARC } from "@/lib/arc";

/**
 * Thin top banner making it unmistakable this is a testnet demo — so visitors
 * don't expect real funds to move. Shows the active x402 mode at a glance.
 */
export function TestnetBanner() {
  const mode = (process.env.X402_MODE ?? "mock").toLowerCase();
  const live = mode === "live";
  return (
    <div className="border-b border-line bg-panel/60 text-center text-[11px] sm:text-xs text-muted">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 py-1.5">
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-mint" : "bg-amber-400"}`} />
          <span className="font-semibold text-ink">Testnet demo</span>
        </span>
        <span className="hidden sm:inline opacity-40">·</span>
        <span>
          Running on <span className="text-ink">Arc Testnet</span> · x402 payments in{" "}
          <span className="text-ink">{live ? "live" : "mock"}</span> mode
        </span>
        <span className="hidden sm:inline opacity-40">·</span>
        <span>no real funds {live ? "beyond testnet USDC " : ""}move</span>
        <span className="hidden md:inline opacity-40">·</span>
        <a
          href={ARC.explorer}
          target="_blank"
          rel="noreferrer"
          className="hidden md:inline text-primary hover:underline"
        >
          block explorer ↗
        </a>
      </div>
    </div>
  );
}
