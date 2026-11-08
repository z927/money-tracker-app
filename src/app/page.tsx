"use client";

import { useEffect, useState } from "react";

type Link = { requisitionId: string; institutionId: string; institutionName: string; status?: string; accounts?: string[]; error?: string };
type Tx = {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  remittanceInformationUnstructured?: string;
  creditorName?: string;
  debtorName?: string;
  transactionAmount?: { amount?: string; currency?: string };
};
type Balance = { balanceAmount?: { amount?: string; currency?: string }; balanceType?: string; referenceDate?: string };

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
  return data as T;
}

function fmtAmount(amount?: string, currency?: string) {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency || ""}`.trim();
  try {
    return new Intl.NumberFormat("it-IT", { style: currency ? "currency" : "decimal", currency: currency || undefined, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
}

function pill(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "LN") return "bg-emerald-400/12 text-emerald-300 ring-1 ring-emerald-400/25";
  if (["CR", "GC", "UA", "SA", "GA"].includes(s)) return "bg-amber-400/12 text-amber-200 ring-1 ring-amber-400/25";
  if (s === "EX" || s === "RJ" || s === "SU") return "bg-rose-400/12 text-rose-200 ring-1 ring-rose-400/25";
  return "bg-slate-400/12 text-slate-300 ring-1 ring-slate-400/20";
}

const statusLabel: Record<string, string> = {
  LN: "Collegato", CR: "Creato", GC: "Consenso", UA: "Autenticazione", SA: "Selezione", GA: "Accesso", EX: "Scaduto", RJ: "Rifiutato", SU: "Sospeso",
};

export default function Home() {
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ balances?: Balance[] } | null>(null);
  const [txs, setTxs] = useState<{ transactions?: { booked?: Tx[]; pending?: Tx[] } } | null>(null);
  const [accountBalances, setAccountBalances] = useState<Record<string, { amount?: string; currency?: string } | null>>({});
  const [balancesBusy, setBalancesBusy] = useState<boolean>(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadAllBalances(links: Link[]) {
    const accounts = links.flatMap((l) => (l.accounts || []).map((a) => ({ accountId: a, institutionId: l.institutionId, institutionName: l.institutionName })));
    if (!accounts.length) { setAccountBalances({}); return; }
    setBalancesBusy(true);
    try {
      const results = await Promise.allSettled(accounts.map(({ accountId }) => j<{ balances?: Balance[] }>(`/api/gocardless/accounts/${accountId}/balances`)));
      const next: Record<string, { amount?: string; currency?: string } | null> = {};
      results.forEach((r, i) => {
        let b: { amount?: string; currency?: string } | null = null;
        if (r.status === "fulfilled") {
          const list = r.value.balances || [];
          const picked = list.find((x) => x.balanceType === "interimBooked") || list[0];
          if (picked?.balanceAmount) b = { amount: picked.balanceAmount.amount, currency: picked.balanceAmount.currency };
        }
        next[accounts[i].accountId] = b;
      });
      setAccountBalances(next);
    } finally { setBalancesBusy(false); }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await j<Link[]>("/api/gocardless/links");
        if (!cancelled) setLinks(data);
        if (!cancelled) await loadAllBalances(data);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function loadLinks() {
    setBusy("links"); setErr(null);
    try {
      const data = await j<Link[]>("/api/gocardless/links");
      setLinks(data);
      await loadAllBalances(data);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  async function loadAccount(accountId: string) {
    setSelectedAccount(accountId); setBusy(accountId); setErr(null); setBalances(null); setTxs(null);
    try {
      const [b, t] = await Promise.all([
        j<{ balances?: Balance[] }>(`/api/gocardless/accounts/${accountId}/balances`),
        j<{ transactions?: { booked?: Tx[]; pending?: Tx[] } }>(`/api/gocardless/accounts/${accountId}/transactions`),
      ]);
      setBalances(b); setTxs(t);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const totalAccounts = links.reduce((n, l) => n + (l.accounts?.length || 0), 0);
  const booked = txs?.transactions?.booked || [];

  const entries = Object.entries(accountBalances);
  const totalAmount = entries.reduce((sum, [, b]) => sum + (Number(b?.amount || 0) || 0), 0);
  const totalCurrency = entries.find(([, b]) => b?.currency)?.[1]?.currency || "EUR";

  const byInstitution = entries.reduce<{ institutionId: string; institutionName: string; total: number; currency: string }[]>((acc, [accountId, b]) => {
    const link = links.find((l) => (l.accounts || []).includes(accountId));
    if (!link || !b) return acc;
    const n = Number(b.amount || 0) || 0;
    const cur = b.currency || totalCurrency;
    const existing = acc.find((x) => x.institutionId === link.institutionId);
    if (existing) existing.total += n;
    else acc.push({ institutionId: link.institutionId, institutionName: link.institutionName, total: n, currency: cur });
    return acc;
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_78%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="glass rounded-3xl p-6 sm:p-8 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
              GoCardless PSD2 · Open Banking
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Money Tracker</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Saldo complessivo e spaccato per istituto. Apri un account per vedere le transazioni.
            </p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Collegamenti" value={String(links.length)} />
            <Stat label="Account" value={String(totalAccounts)} />
            <Stat label="Paese" value="IT" />
          </div>
        </header>

        {err && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-400/20 text-xs">!</span>
            <div className="min-w-0 break-words">{err}</div>
          </div>
        )}

        <section className="mt-6 glass rounded-3xl p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Saldo complessivo</h2>
              <p className="mt-1 text-sm text-slate-400">
                {totalAccounts} conti collegati · {byInstitution.length} istituti
              </p>
            </div>
            <div className="text-right sm:text-left">
              <div className="text-3xl font-bold tracking-tight text-white">{fmtAmount(totalAmount.toFixed(2), totalCurrency)}</div>
              {balancesBusy && <div className="mt-1 text-xs text-slate-400">Aggiornamento saldi…</div>}
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {byInstitution.map((inst) => (
              <div key={inst.institutionId} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{inst.institutionName}</div>
                <div className="mt-1.5 text-lg font-semibold text-white">{fmtAmount(inst.total.toFixed(2), inst.currency)}</div>
              </div>
            ))}
            {!byInstitution.length && (
              <div className="col-span-full rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                Nessun saldo disponibile. Collega un conto da Connetti banca e aggiorna.
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Conti collegati</h2>
              <p className="text-sm text-slate-400">Stato consenso e account disponibili.</p>
            </div>
            <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50" onClick={loadLinks} disabled={busy === "links"}>
              {busy === "links" ? "Aggiorno…" : "Aggiorna"}
            </button>
          </div>
          <ul className="scroll-fade max-h-[520px] space-y-3 overflow-auto pr-1">
            {links.map((l) => (
              <li key={l.requisitionId} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-100">{l.institutionName}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">{l.requisitionId}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${pill(l.status)}`}>
                    {statusLabel[l.status || ""] || l.status || "?"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(l.accounts || []).map((a) => (
                    <button key={a} className={`rounded-xl px-3 py-2 text-xs font-medium transition ${selectedAccount === a ? "bg-accent text-slate-950 shadow-[0_0_0_1px_rgba(136,132,255,0.35)]" : "border border-white/10 bg-slate-900/60 text-slate-200 hover:border-accent/25 hover:text-accent"}`} onClick={() => loadAccount(a)}>
                      {busy === a ? "…" : `Account ${a.slice(0, 8)}`}
                    </button>
                  ))}
                  {!l.accounts?.length && <span className="text-xs text-slate-500">Nessun account disponibile. Completa il consenso bancario o aggiorna tra poco.</span>}
                </div>
                {l.error && <div className="mt-2 rounded-xl border border-rose-400/15 bg-rose-500/10 p-2 text-xs text-rose-200">{l.error}</div>}
              </li>
            ))}
            {!links.length && (
              <li className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                Nessun collegamento salvato. Vai su Connetti banca per iniziare.
              </li>
            )}
          </ul>
        </section>

        {selectedAccount && (
          <section className="glass mt-6 rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Dettaglio account</h2>
                <p className="font-mono text-xs text-slate-500">{selectedAccount}</p>
              </div>
              <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10" onClick={() => loadAccount(selectedAccount)}>
                Ricarica
              </button>
            </div>

            {busy === selectedAccount && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-accent to-accent-2" /></div>}

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold text-slate-200">Saldi</h3>
                <div className="mt-3 space-y-2">
                  {(balances?.balances || []).map((b, i) => (
                    <div key={i} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">{b.balanceType || "Balance"}</div>
                      <div className="mt-1 text-xl font-semibold text-white">{fmtAmount(b.balanceAmount?.amount, b.balanceAmount?.currency)}</div>
                      {b.referenceDate && <div className="mt-1 text-xs text-slate-500">{b.referenceDate}</div>}
                    </div>
                  ))}
                  {!balances?.balances?.length && <p className="text-sm text-slate-500">Nessun saldo disponibile.</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Transazioni contabilizzate</h3>
                  <span className="text-xs text-slate-500">{booked.length} voci</span>
                </div>
                <ul className="scroll-fade mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
                  {booked.slice(0, 80).map((t, i) => {
                    const amt = Number(t.transactionAmount?.amount || 0);
                    const negative = !Number.isNaN(amt) && amt < 0;
                    return (
                      <li key={t.transactionId || t.internalTransactionId || i} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm text-slate-100">{t.remittanceInformationUnstructured || t.creditorName || t.debtorName || "Transazione"}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{t.bookingDate || t.valueDate || "—"}</div>
                          </div>
                          <div className={`shrink-0 text-sm font-semibold ${negative ? "text-rose-300" : "text-emerald-300"}`}>
                            {fmtAmount(t.transactionAmount?.amount, t.transactionAmount?.currency)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {!booked.length && <li className="text-sm text-slate-500">Nessuna transazione contabilizzata disponibile.</li>}
                </ul>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
