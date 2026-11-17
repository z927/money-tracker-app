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
  const country = url.searchParams.get('country') || 'it'

  try {
    const res = await fetch(`${GC_URL}/institutions/?country=${country}`, {
      headers: { Authorization: `Bearer ${GC_SECRET}`, Accept: 'application/json' },
    })
    const data = await res.json()
    const institutions = (data.results || []).map((i: any) => ({
      id: i.id,
      name: i.name,
      bic: i.bic,
      countries: i.countries,
      logo: i.logo,
    }))
    return new Response(JSON.stringify(institutions), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
