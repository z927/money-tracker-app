const GC_BASE = "https://bankaccountdata.gocardless.com/api/v2";

type TokenResponse = { access: string; access_expires: number; refresh: string; refresh_expires: number };

let cached: { access: string; expiresAt: number } | null = null;

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function getAccessToken() {
  const direct = process.env.GOCARDLESS_ACCESS_TOKEN?.trim();
  if (direct) return direct;

  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 30 > now) return cached.access;

  const res = await fetch(`${GC_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      secret_id: env("GOCARDLESS_SECRET_ID"),
      secret_key: env("GOCARDLESS_SECRET_KEY"),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GoCardless token error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as TokenResponse;
  cached = { access: data.access, expiresAt: now + data.access_expires };
  return data.access;
}

export async function gc<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GC_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GoCardless ${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
