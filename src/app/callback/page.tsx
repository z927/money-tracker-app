import Link from "next/link";

export default function CallbackPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_280px_at_50%_20%,rgba(34,211,238,0.18),transparent_60%)]" />
      <div className="glass relative max-w-md rounded-3xl p-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">Consenso completato</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Se hai autorizzato la banca, GoCardless sta preparando l’accesso ai conti. Torna alla dashboard e premi <span className="text-slate-200">Aggiorna</span> per caricare gli account.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
          Torna alla dashboard
        </Link>
      </div>
    </div>
  );
}
