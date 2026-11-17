# Configurazione Supabase — Money Tracker

## 1. Variabili d'ambiente

Aggiungi al file `.env.local` (root del progetto):

```
NEXT_PUBLIC_SUPABASE_URL=https://<tuo-progetto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<chiave-service-role>
```

Queste due variabili vengono usate dal client admin lato server (`src/lib/supabase.ts`).

## 2. Database — esegui lo schema

Dal pannello Supabase (SQL Editor) o con la CLI, esegui:

```
supabase/schema.sql
```

Crea le seguenti tabelle:
- `profiles` — profili utente
- `accounts` — conti bancari collegati (GoCardless)
- `balances` — saldi per account
- `transactions` — transazioni contabilizzate

## 3. Client Supabase lato server

`src/lib/supabase.ts` espone `supabaseAdmin`, istanziato con `SUPABASE_SERVICE_ROLE_KEY`. Usalo solo nelle Server Actions e API route, mai lato client browser.

## 4. Salvataggio dati (Server Action)

`src/app/actions/save.ts` espone `saveAccountData`:

```ts
import { saveAccountData } from "@/app/actions/save";

await saveAccountData({
  userId: "demo-user",
  accounts: [{ accountId, institutionId, institutionName }],
  balances: { [accountId]: balanceInput },
  transactions: { [accountId]: transactionsArray },
});
```

Viene chiamato da `src/app/page.tsx` dopo:
- il caricamento iniziale dei link (`/api/gocardless/links`)
- l'apertura di un account (saldo + transazioni)

## 5. Edge Function — sincronizzazione webhook GoCardless

### File
`supabase/functions/gocardless-sync/index.ts`

### Cosa fa
Riceve gli eventi webhook da GoCardless (`requisition` / `account`), recupera dettagli conto, saldi e transazioni tramite API GoCardless e li upsert su Supabase.

### Deploy

```bash
# Installa Supabase CLI (se non presente)
npm install supabase --save-dev

# Login
npx supabase login

# Link al progetto
npx supabase link --project-ref <project-ref>

# Imposta le secret dell'Edge Function
npx supabase secrets set GOCARDLESS_SECRET_ID=<id> GOCARDLESS_SECRET_KEY=<chiave> SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<chiave>

# Deploy
npx supabase functions deploy gocardless-sync
```

### Variabili richieste sull'Edge Function
- `GOCARDLESS_SECRET_ID`
- `GOCARDLESS_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 6. Registra il webhook su GoCardless

Chiama l'API route Next.js:

```
POST /api/gocardless/webhooks
Body: { "url": "https://<tuo-progetto>.functions.supabase.co/gocardless-sync" }
```

Questo registra l'URL dell'Edge Function come endpoint webhook su GoCardless, così riceverà le notifiche su creazione/aggiornamento di requisizioni e account.

## 7. Flusso completo

1. Utente collega banca su GoCardless (flussi esistenti in `/connect` e `/callback`)
2. La pagina chiama `saveAccountData` e salva account/saldi/transazioni su Supabase
3. GoCardless invia webhook all'Edge Function `gocardless-sync`
4. L'Edge Function aggiorna Supabase in tempo reale
5. La pagina legge i dati da Supabase (opzionale, da implementare nelle Server Actions di lettura)

## Struttura file creati

| File | Descrizione |
|------|-------------|
| `src/lib/supabase.ts` | Client admin Supabase lato server |
| `supabase/schema.sql` | Schema database (tabelle) |
| `src/app/actions/save.ts` | Server Action di salvataggio |
| `supabase/functions/gocardless-sync/index.ts` | Edge Function webhook |
| `src/app/api/gocardless/webhooks/route.ts` | Registrazione webhook su GoCardless |
| `.env.local` | Variabili d'ambiente (da compilare) |
