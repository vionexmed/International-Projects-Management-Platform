import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { search } from "@/server/services/search";

/** Backs the command palette. Results are scoped to the caller. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const term = new URL(request.url).searchParams.get("q") ?? "";

  try {
    const results = await search(user, term);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[search] failed", error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
