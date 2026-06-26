import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { first_name, last_name, company, linkedin_url } = await req.json();

  const apiKey = process.env.LUSHA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "LUSHA_API_KEY manquant dans .env.local" }, { status: 500 });
  }

  if (!first_name || !last_name) {
    return NextResponse.json({ error: "Prénom et nom requis" }, { status: 400 });
  }
  if (!company) {
    return NextResponse.json({ error: "Entreprise requise pour la recherche Lusha — renseignez le champ Entreprise sur la fiche candidat" }, { status: 400 });
  }
  const params = new URLSearchParams();
  params.set("firstName", first_name);
  params.set("lastName", last_name);
  params.set("companyName", company);

  try {
    const res = await fetch(`https://api.lusha.com/v2/person?${params.toString()}`, {
      headers: { "api_key": apiKey },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Lusha API ${res.status}: ${err}` }, { status: res.status });
    }

    const data = await res.json();

    // Log raw response for debugging
    console.log("[lusha-enrich] raw response:", JSON.stringify(data, null, 2));

    // Structure: data.contact.data
    const contact = data.contact?.data ?? null;

    const email =
      contact?.emailAddresses?.find((e: { emailType?: string }) => e.emailType === "work")?.email ??
      contact?.emailAddresses?.[0]?.email ??
      null;

    const phone =
      contact?.phoneNumbers?.find((p: { phoneType: string }) => p.phoneType === "mobile")?.number ??
      contact?.phoneNumbers?.[0]?.number ??
      null;

    return NextResponse.json({ email, phone });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
