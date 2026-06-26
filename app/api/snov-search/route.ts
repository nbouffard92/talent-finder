import { NextRequest, NextResponse } from "next/server";

async function getSnovToken(): Promise<string> {
  const res = await fetch("https://api.snov.io/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.SNOV_CLIENT_ID,
      client_secret: process.env.SNOV_CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Impossible d'obtenir le token Snov.io");
  return data.access_token;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const { domain, titles, location } = await req.json();

  if (!process.env.SNOV_CLIENT_ID || !process.env.SNOV_CLIENT_SECRET) {
    return NextResponse.json({ error: "Clés API Snov.io non configurées (SNOV_CLIENT_ID / SNOV_CLIENT_SECRET)" }, { status: 500 });
  }

  if (!domain) {
    return NextResponse.json({ error: "Le domaine de l'entreprise est requis" }, { status: 400 });
  }

  try {
    const token = await getSnovToken();

    // 1. Démarrer la recherche
    const startRes = await fetch("https://api.snov.io/v2/domain-search/prospects/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        domain,
        positions: titles || [],
        ...(location ? { locations: [location] } : {}),
      }),
    });

    if (!startRes.ok) {
      const err = await startRes.text();
      return NextResponse.json({ error: `Snov.io: ${err}` }, { status: startRes.status });
    }

    const { task_hash } = await startRes.json();

    // 2. Polling jusqu'à 15s
    for (let i = 0; i < 10; i++) {
      await sleep(1500);
      const resultRes = await fetch(
        `https://api.snov.io/v2/domain-search/prospects/result/${task_hash}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const result = await resultRes.json();

      if (result.prospects !== undefined) {
        const people = (result.prospects || []).map((p: Record<string, unknown>) => ({
          apollo_id: `snov_${p.id ?? Math.random().toString(36).slice(2)}`,
          first_name: (p.first_name as string) || "",
          last_name: (p.last_name as string) || "",
          title: (p.position as string) || "",
          company: domain,
          linkedin_url: (p.source_page as string) || null,
          email: null,
          location: location || "",
          summary: "",
        }));
        return NextResponse.json({ people });
      }
    }

    return NextResponse.json({ error: "Délai dépassé, réessayez dans quelques secondes", people: [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
