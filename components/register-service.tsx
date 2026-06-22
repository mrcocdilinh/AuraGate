"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProbeResult } from "@/lib/x402-probe";

function ProbeChecklist({ result }: { result: ProbeResult }) {
  const icon = (s: string) => (s === "pass" ? "✓" : s === "warn" ? "!" : "✕");
  const color = (s: string) =>
    s === "pass" ? "text-mint" : s === "warn" ? "text-amber" : "text-danger";
  return (
    <div className={`rounded-xl border p-4 ${result.ok ? "border-mint/30 bg-mint/5" : "border-danger/30 bg-danger/5"}`}>
      <p className={`text-sm font-semibold ${result.ok ? "text-mint" : "text-danger"}`}>
        {result.ok ? "✓ " : "✕ "}
        {result.summary}
      </p>
      <ul className="mt-2.5 space-y-2">
        {result.checks.map((c, i) => (
          <li key={i} className="flex gap-2 text-xs">
            <span className={`mt-px font-bold ${color(c.status)}`}>{icon(c.status)}</span>
            <span>
              <span className={c.status === "fail" ? "text-ink" : "text-muted"}>{c.label}</span>
              {c.detail && <span className="block text-[11px] text-muted/80">{c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STANDARD_EXAMPLE = `// Minimal x402 endpoint — what AuraGate health-checks.
// Called WITHOUT payment, it must reply 402 with this JSON challenge:
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:5042002",          // Arc testnet
    "asset": "0x3600000000000000000000000000000000000000", // USDC on Arc
    "amount": "10000",                     // price in atomic USDC (6 dp) → $0.01
    "payTo": "0xYourWalletAddress",        // where the USDC lands
    "maxTimeoutSeconds": 60
  }],
  "error": "Payment required"
}
// Once the buyer retries with a valid X-PAYMENT header, return your data (200).`;

/** Field-level hint shown under each label. */
function Field({
  label,
  hint,
  children,
  full,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function RegisterService({
  address,
  sellerName,
  onCreated,
}: {
  address?: string;
  sellerName?: string;
  onCreated?: () => void;
}) {
  const empty = {
    name: "",
    description: "",
    price: "0.01",
    category: "data",
    method: "GET",
    sellerName: "",
    externalUrl: "",
    docsUrl: "",
    tags: "",
    sampleResponse: "",
  };
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "externalUrl" || k === "method" || k === "price") setProbe(null);
  };

  async function testEndpoint() {
    setTesting(true);
    setProbe(null);
    setMsg(null);
    try {
      const res = await fetch("/api/services/probe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: form.externalUrl, method: form.method, price: form.price }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setProbe(data as ProbeResult);
      else setMsg({ ok: false, text: data.error ?? "Could not test endpoint" });
    } catch {
      setMsg({ ok: false, text: "Network error while testing the endpoint" });
    }
    setTesting(false);
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        sellerAddress: address ?? "0x0000000000000000000000000000000000000000",
        sellerName: form.sellerName || sellerName || "You",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const verified = data.service?.verified;
      if (data.probe) setProbe(data.probe as ProbeResult);
      setMsg({
        ok: true,
        text: form.externalUrl
          ? verified
            ? "Listed ✓ — your endpoint passed the x402 health-check (verified)."
            : "Listed as unverified — your endpoint didn't pass the x402 check (see below). Fix it and re-list."
          : "Service listed ✓ (hosted demo endpoint on AuraGate).",
      });
      if (verified || !form.externalUrl) {
        setForm(empty);
        setProbe(null);
      }
      onCreated?.();
    } else {
      setMsg({ ok: false, text: data.error ?? "Failed to list service" });
    }
    setBusy(false);
  }

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">List a service</h2>
        <Link href="/docs#sell" className="text-sm text-primary hover:underline">
          Full seller guide →
        </Link>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Register any x402 endpoint — your own hosted URL, or leave it blank to get a free
        hosted demo endpoint at <code className="text-ink">/api/premium/[slug]</code>.
        Fields marked <span className="text-ink">*</span> are required.
      </p>

      {/* What can I sell? — collapsible guidance */}
      <button
        type="button"
        onClick={() => setShowGuide((s) => !s)}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-line bg-panel2/40 px-4 py-3 text-left text-sm font-medium text-ink"
      >
        <span>📘 What can I sell, and what makes a valid x402 endpoint?</span>
        <span className="text-muted">{showGuide ? "▲" : "▼"}</span>
      </button>
      {showGuide && (
        <div className="mt-2 space-y-3.5 rounded-xl border border-line bg-bg/40 p-4 text-sm text-muted">
          <div>
            <p className="font-semibold text-ink">1. Pick what to sell</p>
            <p className="mt-1">
              Anything an AI agent would pay a few cents for: live data (prices, weather,
              sports), an AI task (summarize, classify), a compute job, or a paid wrapper
              around an existing API you run. You keep hosting it — AuraGate just lists it
              and routes payment.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">2. Make it speak x402</p>
            <p className="mt-1">
              When called <strong className="text-ink">without payment</strong>, your URL must
              reply <code className="text-ink">402</code> with a JSON challenge. After the buyer
              pays, return your data with <code className="text-ink">200</code>.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-3.5 font-mono text-[11px] leading-relaxed text-mint">
              {STANDARD_EXAMPLE}
            </pre>
          </div>
          <div>
            <p className="font-semibold text-ink">3. Test it here, then list</p>
            <p className="mt-1">
              Paste your URL below and hit <strong className="text-ink">Test endpoint</strong>.
              AuraGate checks the live 402 challenge and tells you exactly what to fix. No
              endpoint yet? Leave the URL blank to get a free hosted demo endpoint.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Service name *" hint="A clear, short title buyers see in the registry.">
          <input className="input" placeholder="e.g. Global Weather Now" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Seller / brand name" hint="Shown as the provider. Defaults to your login name.">
          <input className="input" placeholder="e.g. WeatherWorks" value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} />
        </Field>

        <Field label="Description *" hint="What it does and how to call it (query params, etc.). One or two sentences." full>
          <textarea className="input min-h-24" placeholder="Live temperature, humidity and wind for major cities. Add ?city=tokyo." value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <Field label="Price (USDC) *" hint="Per request, as a decimal string. e.g. 0.002 = $0.002.">
          <input className="input" placeholder="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} />
        </Field>
        <Field label="Category" hint="Helps buyers filter the registry.">
          <select className="input w-full" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {["data", "ai", "oracle", "compute", "market-insight"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="HTTP method" hint="GET for simple reads, POST if buyers send a body.">
          <select className="input w-full" value={form.method} onChange={(e) => set("method", e.target.value)}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </Field>
        <Field label="Tags" hint="Comma-separated keywords for search. e.g. weather, realtime.">
          <input className="input" placeholder="weather, realtime, cities" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
        </Field>

        {/* Endpoint URL + live test */}
        <Field
          label="Your x402 endpoint URL"
          hint="Optional. Leave blank to host a free demo on AuraGate. If you provide one, click Test endpoint to verify it returns a valid 402 challenge."
          full
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="input flex-1"
              placeholder="https://my-api.com/x402/weather"
              value={form.externalUrl}
              onChange={(e) => set("externalUrl", e.target.value)}
            />
            <button
              type="button"
              className="btn-ghost whitespace-nowrap disabled:opacity-40"
              onClick={testEndpoint}
              disabled={testing || !form.externalUrl}
              title="Check your endpoint returns a valid x402 challenge"
            >
              {testing ? "Testing…" : "🔍 Test endpoint"}
            </button>
          </div>
          {probe && (
            <div className="mt-2.5">
              <ProbeChecklist result={probe} />
            </div>
          )}
        </Field>

        <Field label="Docs / homepage URL" hint="Optional. A link buyers can open to learn more." full>
          <input className="input" placeholder="https://my-api.com/docs" value={form.docsUrl} onChange={(e) => set("docsUrl", e.target.value)} />
        </Field>

        <Field
          label="Sample response (JSON)"
          hint="Optional but recommended. Shown on your service page so buyers know what they get. For hosted demos, this is the data returned after payment."
          full
        >
          <textarea
            className="input min-h-24 font-mono text-xs"
            placeholder='{"city": "Hanoi", "temperatureC": 31}'
            value={form.sampleResponse}
            onChange={(e) => set("sampleResponse", e.target.value)}
          />
        </Field>

        <button className="btn-primary py-3 text-base sm:col-span-2" onClick={submit} disabled={busy || !form.name}>
          {busy ? "Listing…" : "List service →"}
        </button>
        {form.externalUrl && probe && !probe.ok && (
          <p className="text-center text-xs text-amber sm:col-span-2">
            Heads up: this endpoint hasn&apos;t passed the x402 check — you can still list it,
            but it&apos;ll be marked <strong>Unverified</strong> until it does.
          </p>
        )}
        {msg && (
          <p className={`text-center text-sm sm:col-span-2 ${msg.ok ? "text-mint" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
