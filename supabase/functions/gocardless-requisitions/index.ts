import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const GC_URL = Deno.env.get('GOCARDLESS_API_URL') || 'https://bankaccountdata.gocardless.com/api/v2'
const GC_SECRET = Deno.env.get('GOCARDLESS_SECRET')

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }
  if (!GC_SECRET) {
    return new Response(JSON.stringify({ error: 'Missing GOCARDLESS_SECRET' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const body = await req.json()
    const { institutionId, institutionName, country } = body

    const res = await fetch(`${GC_URL}/requisitions/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GC_SECRET}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        institution_id: institutionId,
        institution_name: institutionName,
        country,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error || `HTTP ${res.status}` }), { status: res.status, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ link: data.link }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
