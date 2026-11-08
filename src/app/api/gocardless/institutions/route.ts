import { NextResponse } from "next/server";
import { gc } from "@/lib/gocardless";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country") || "it";
  try {
    const data = await gc<unknown[]>(`/institutions/?country=${encodeURIComponent(country)}`);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
