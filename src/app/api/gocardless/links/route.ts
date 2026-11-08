import { NextResponse } from "next/server";
import { gc } from "@/lib/gocardless";
import { getLinks } from "@/lib/store";

export async function GET() {
  try {
    const links = await getLinks();
    const enriched = await Promise.all(
      links.map(async (l) => {
        try {
          const req = await gc<{ id: string; status: string; accounts: string[] }>(`/requisitions/${l.requisitionId}/`);
          return { ...l, status: req.status, accounts: req.accounts };
        } catch (e) {
          return { ...l, status: "error", accounts: [], error: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    return NextResponse.json(enriched);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
