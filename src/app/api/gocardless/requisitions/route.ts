import { NextResponse } from "next/server";
import { gc } from "@/lib/gocardless";
import { saveLink } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      institutionId: string;
      institutionName: string;
      country?: string;
    };
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const agreement = await gc<{ id: string }>("/agreements/enduser/", {
      method: "POST",
      body: JSON.stringify({
        institution_id: body.institutionId,
        max_historical_days: 90,
        access_valid_for_days: 90,
        access_scope: ["balances", "details", "transactions"],
      }),
    });
    const requisition = await gc<{ id: string; link: string }>("/requisitions/", {
      method: "POST",
      body: JSON.stringify({
        redirect: `${origin}/callback`,
        institution_id: body.institutionId,
        agreement: agreement.id,
        reference: `mt-${Date.now()}`,
        user_language: "IT",
      }),
    });
    await saveLink({
      requisitionId: requisition.id,
      institutionId: body.institutionId,
      institutionName: body.institutionName,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: requisition.id, link: requisition.link });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
