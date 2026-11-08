"use client";

import { useEffect, useMemo, useState } from "react";

type Institution = { id: string; name: string; bic?: string; countries?: string[]; logo?: string };
type Link = { requisitionId: string; institutionId: string; institutionName: string; status?: string; accounts?: string[]; error?: string };

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
  return data as T;
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

export default function Connect() {
  const [country, setCountry] = useState("it");
  const [q, setQ] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
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
    setBusy("links"); setErr(null);
    try { setLinks(await j<Link[]>("/api/gocardless/links")); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  async function search() {
    setBusy("search"); setErr(null);
    try { setInstitutions(await j<Institution[]>(`/api/gocardless/institutions?country=${encodeURIComponent(country)}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? institutions.filter((i) => i.name.toLowerCase().includes(s) || (i.bic || "").toLowerCase().includes(s)) : institutions;
    return base.slice(0, 50);
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

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="glass rounded-3xl p-6 sm:p-8 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Connetti una banca</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Cerca BPER, BBVA, Revolut e avvia il consenso PSD2 per sincronizzare saldi e transazioni.
          </p>
        </header>

        {err && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-400/20 text-xs">!</span>
            <div className="min-w-0 break-words">{err}</div>
          </div>
        )}

        <section className="glass rounded-3xl p-5 sm:p-6 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Scegli un istituto</h2>
              <p className="text-sm text-slate-400">{filtered.length} risultati</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <select className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-400/30 transition focus:ring" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="it">Italia (IT)</option>
                <option value="es">Spagna (ES)</option>
                <option value="gb">Regno Unito (GB)</option>
                <option value="de">Germania (DE)</option>
                <option value="fr">Francia (FR)</option>
              </select>
              <button className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50" onClick={search} disabled={busy === "search"}>
                {busy === "search" ? "Caricamento…" : "Carica istituti"}
              </button>
              <input className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-cyan-400/30 transition focus:ring" placeholder="Filtra per nome o BIC…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <ul className="scroll-fade mt-4 max-h-[520px] space-y-2 overflow-auto pr-1">
            {filtered.map((i) => (
              <li key={i.id} className="group flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 transition hover:border-cyan-400/20 hover:bg-white/[0.05]">
                <div className="flex min-w-0 items-center gap-3">
                  {i.logo ? <img src={i.logo} alt="" loading="lazy" className="h-9 w-9 rounded-xl bg-white/90 object-contain p-1" /> : <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-xs font-semibold text-slate-300">{i.name.slice(0, 2).toUpperCase()}</div>}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-100">{i.name}</div>
                    <div className="truncate font-mono text-[11px] text-slate-500">{i.bic || i.id.slice(0, 18)}</div>
                  </div>
                </div>
                <button className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:opacity-50" onClick={() => connect(i)} disabled={!!busy}>
                  {busy === i.id ? "Redirect…" : "Connetti"}
                </button>
              </li>
            ))}
            {!filtered.length && (
              <li className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                Carica gli istituti per il paese selezionato, poi filtra per banca.
              </li>
            )}
          </ul>
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Collegamenti esistenti</h2>
              <p className="text-sm text-slate-400">Stato consenso e account disponibili.</p>
            </div>
            <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50" onClick={loadLinks} disabled={busy === "links"}>
              {busy === "links" ? "Aggiorno…" : "Aggiorna"}
            </button>
          </div>
          <ul className="scroll-fade max-h-[420px] space-y-3 overflow-auto pr-1">
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
                    <button key={a} className="rounded-xl px-3 py-2 text-xs font-medium border border-white/10 bg-slate-900/60 text-slate-200 hover:border-cyan-400/25 hover:text-cyan-100 transition">
                      Account {a.slice(0, 8)}
                    </button>
                  ))}
                  {!l.accounts?.length && <span className="text-xs text-slate-500">Nessun account disponibile. Completa il consenso bancario o aggiorna tra poco.</span>}
                </div>
                {l.error && <div className="mt-2 rounded-xl border border-rose-400/15 bg-rose-500/10 p-2 text-xs text-rose-200">{l.error}</div>}
              </li>
            ))}
            {!links.length && (
              <li className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                Nessun collegamento salvato. Connetti una banca per iniziare.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
