export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="container-page flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted sm:flex-row">
        <p>
          AuraGate · stablecoin-native agent commerce on{" "}
          <span className="text-ink">Arc</span>
        </p>
        <p className="text-xs">
          Testnet MVP · powered by x402 + Circle Gateway · not financial advice
        </p>
      </div>
    </footer>
  );
}