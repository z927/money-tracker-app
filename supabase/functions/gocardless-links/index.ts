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

  try {
    const res = await fetch(`${GC_URL}/requisitions/`, {
      headers: { Authorization: `Bearer ${GC_SECRET}`, Accept: 'application/json' },
    })
    const data = await res.json()
    const links = (data.results || []).map((r: any) => ({
      requisitionId: r.id,
      institutionId: r.institution_id,
      institutionName: r.institution_name,
      status: r.status,
      accounts: r.accounts || [],
      error: r.error,
    }))
    return new Response(JSON.stringify(links), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
