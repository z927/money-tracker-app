"use client";

import { useEffect, useMemo, useState } from "react";

type Institution = { id: string; name: string; bic?: string; countries?: string[]; logo?: string };
type Link = { requisitionId: string; institutionId: string; institutionName: string; status?: string; accounts?: string[]; error?: string };
type Tx = { transactionId?: string; internalTransactionId?: string; bookingDate?: string; valueDate?: string; remittanceInformationUnstructured?: string; transactionAmount?: { amount?: string; currency?: string } };

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
  return data as T;
}

export default function Home() {
  const [country, setCountry] = useState("it");
  const [q, setQ] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [balances, setBalances] = useState<unknown>(null);
  const [txs, setTxs] = useState<{ transactions?: { booked?: Tx[]; pending?: Tx[] } } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await j<Link[]>("/api/gocardless/links");
        if (!cancelled) setLinks(data);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function loadLinks() {
    try {
      setLinks(await j<Link[]>("/api/gocardless/links"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function search() {
    setBusy("search"); setErr(null);
    try {
      setInstitutions(await j<Institution[]>(`/api/gocardless/institutions?country=${encodeURIComponent(country)}`));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return institutions.slice(0, 40);
    return institutions.filter((i) => i.name.toLowerCase().includes(s) || (i.bic || "").toLowerCase().includes(s)).slice(0, 60);
  }, [institutions, q]);

  async function connect(inst: Institution) {
    setBusy(inst.id); setErr(null);
    try {
      const data = await j<{ link: string }>("/api/gocardless/requisitions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId: inst.id, institutionName: inst.name, country }),
      });
      window.location.assign(data.link);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(null); }
  }

  async function loadAccount(accountId: string) {
    setSelectedAccount(accountId); setBusy(accountId); setErr(null); setBalances(null); setTxs(null);
    try {
      const [b, t] = await Promise.all([
        j<unknown>(`/api/gocardless/accounts/${accountId}/balances`),
        j<{ transactions?: { booked?: Tx[]; pending?: Tx[] } }>(`/api/gocardless/accounts/${accountId}/transactions`),
      ]);
      setBalances(b); setTxs(t);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Money Tracker</h1>
        <p className="mt-1 text-sm text-zinc-600">Collega Revolut, BBVA e BPER via GoCardless (PSD2). Configura <code>.env.local</code> da <code>.env.example</code>.</p>
        {err && <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-white p-4">
            <h2 className="font-medium">1) Trova banca</h2>
            <div className="mt-3 flex gap-2">
              <select className="rounded border px-2 py-2 text-sm" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="it">IT</option><option value="es">ES</option><option value="gb">GB</option><option value="de">DE</option><option value="fr">FR</option>
              </select>
              <button className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50" onClick={search} disabled={busy === "search"}>
                {busy === "search" ? "..." : "Carica istituti"}
              </button>
              <input className="min-w-0 flex-1 rounded border px-3 py-2 text-sm" placeholder="Filtra: BPER, BBVA, Revolut..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
              {filtered.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 rounded border p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {i.logo ? <img src={i.logo} alt="" loading="lazy" className="h-6 w-6 rounded object-contain" /> : <div className="h-6 w-6 rounded bg-zinc-100" />}
                    <span className="truncate text-sm">{i.name}</span>
                  </div>
                  <button className="rounded border px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50" onClick={() => connect(i)} disabled={!!busy}>
                    {busy === i.id ? "..." : "Connetti"}
                  </button>
                </li>
              ))}
              {!filtered.length && <li className="text-sm text-zinc-500">Carica gli istituti per il paese selezionato.</li>}
            </ul>
          </section>

          <section className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">2) Conti collegati</h2>
              <button className="rounded border px-2 py-1 text-xs" onClick={loadLinks}>Aggiorna</button>
            </div>
            <ul className="mt-3 space-y-3">
              {links.map((l) => (
                <li key={l.requisitionId} className="rounded border p-3 text-sm">
                  <div className="font-medium">{l.institutionName}</div>
                  <div className="text-xs text-zinc-500">status: {l.status || "?"} · req: {l.requisitionId}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(l.accounts || []).map((a) => (
                      <button key={a} className={`rounded border px-2 py-1 text-xs ${selectedAccount === a ? "bg-black text-white" : "hover:bg-zinc-50"}`} onClick={() => loadAccount(a)}>
                        {a.slice(0, 8)}…
                      </button>
                    ))}
                    {!l.accounts?.length && <span className="text-xs text-zinc-500">Nessun account (completa il consenso o attendi).</span>}
                  </div>
                  {l.error && <div className="mt-1 text-xs text-red-700">{l.error}</div>}
                </li>
              ))}
              {!links.length && <li className="text-sm text-zinc-500">Nessun collegamento salvato.</li>}
            </ul>
          </section>
        </div>

        {selectedAccount && (
          <section className="mt-6 rounded-xl border bg-white p-4">
            <h2 className="font-medium">Dettaglio account <span className="font-mono text-xs text-zinc-500">{selectedAccount}</span></h2>
            {busy === selectedAccount && <p className="mt-2 text-sm text-zinc-500">Caricamento…</p>}
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium">Saldi</h3>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-100">{JSON.stringify(balances, null, 2)}</pre>
              </div>
              <div>
                <h3 className="text-sm font-medium">Transazioni (booked)</h3>
                <ul className="mt-2 max-h-64 space-y-2 overflow-auto text-sm">
                  {(txs?.transactions?.booked || []).slice(0, 50).map((t, i) => (
                    <li key={t.transactionId || t.internalTransactionId || i} className="rounded border p-2">
                      <div className="flex justify-between gap-2">
                        <span className="text-xs text-zinc-500">{t.bookingDate || t.valueDate}</span>
                        <span className={`font-medium ${Number(t.transactionAmount?.amount) < 0 ? "text-red-700" : "text-emerald-700"}`}>
                          {t.transactionAmount?.amount} {t.transactionAmount?.currency}
                        </span>
                      </div>
                      <div className="text-xs">{t.remittanceInformationUnstructured || "—"}</div>
                    </li>
                  ))}
                  {!txs?.transactions?.booked?.length && <li className="text-xs text-zinc-500">Nessuna transazione (o dati non disponibili).</li>}
                </ul>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
