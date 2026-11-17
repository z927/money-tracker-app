import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const GC_URL = Deno.env.get('GOCARDLESS_API_URL') || 'https://bankaccountdata.gocardless.com/api/v2'
const GC_SECRET = Deno.env.get('GOCARDLESS_SECRET')

serve(async (req) => {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }
  if (!GC_SECRET) {
    return new Response(JSON.stringify({ error: 'Missing GOCARDLESS_SECRET' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const url = new URL(req.url)
  const accountId = url.searchParams.get('account_id')
  if (!accountId) {
    return new Response(JSON.stringify({ error: 'Missing account_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const res = await fetch(`${GC_URL}/accounts/${accountId}/balances/`, {
      headers: { Authorization: `Bearer ${GC_SECRET}`, Accept: 'application/json' },
    })
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
