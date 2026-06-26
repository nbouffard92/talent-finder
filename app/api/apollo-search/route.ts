import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { titles, keywords, locations } = await req.json();

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Apollo API key non configurée" }, { status: 500 });
  }

  try {
    const body: Record<string, unknown> = {
      page: 1,
      per_page: 25,
      person_titles: titles || [],
      q_keywords: keywords || "",
      contact_email_status: ["verified", "likely to engage"],
    };

    if (locations?.length > 0) {
      body.person_locations = locations;
    }

    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Apollo error: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const people = (data.people || []).map((p: Record<string, unknown>) => ({
      apollo_id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      title: p.title,
      company: (p.organization as Record<string, unknown>)?.name || (p.employment_history as Record<string, unknown>[])?.[0]?.organization_name || "",
      linkedin_url: p.linkedin_url,
      email: p.email,
      location: p.city
        ? `${p.city}${p.state ? ", " + p.state : ""}${p.country ? ", " + p.country : ""}`
        : p.country || "",
      summary: p.headline || "",
    }));

    return NextResponse.json({ people });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
