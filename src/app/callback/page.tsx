import Link from "next/link";

export default function CallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-zinc-950">
      <div className="max-w-md rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Consenso completato</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Se hai autorizzato la banca, GoCardless sta preparando l’accesso. Torna alla dashboard e premi “Aggiorna”.
        </p>
        <Link href="/" className="mt-4 inline-block rounded bg-black px-4 py-2 text-sm text-white">Torna alla dashboard</Link>
      </div>
    </div>
  );
}
