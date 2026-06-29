import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();

  const apolloKey = process.env.APOLLO_API_KEY;
  if (!apolloKey) {
    return NextResponse.json({ error: "Apollo API key non configurée" }, { status: 500 });
  }

  // Récupérer le job
  const { data: job, error: jobError } = await supabase
    .from("search_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }

  // Marquer comme en cours
  await supabase.from("search_jobs").update({ status: "running" }).eq("id", jobId);

  // Appel Apollo
  const body: Record<string, unknown> = {
    page: 1,
    per_page: 25,
    person_titles: job.titles || [],
    q_keywords: job.keywords || "",
  };
  if (job.location) body.person_locations = [job.location];

  const apolloRes = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apolloKey },
    body: JSON.stringify(body),
  });

  if (!apolloRes.ok) {
    const err = await apolloRes.text();
    await supabase.from("search_jobs").update({ status: "pending" }).eq("id", jobId);
    return NextResponse.json({ error: `Apollo: ${err}` }, { status: apolloRes.status });
  }

  const apolloData = await apolloRes.json();
  const people: Record<string, unknown>[] = apolloData.people || [];

  // Dédupliquer par linkedin_url
  const { data: existing } = await supabase.from("candidates").select("linkedin_url, first_name, last_name");
  const existingUrls = new Set(
    (existing || []).map((c) => c.linkedin_url).filter(Boolean).map((u: string) => u.toLowerCase())
  );

  let added = 0;
  let skipped = 0;

  for (const person of people) {
    const linkedinUrl = (person.linkedin_url as string | undefined)?.toLowerCase();
    if (linkedinUrl && existingUrls.has(linkedinUrl)) { skipped++; continue; }

    const org = person.organization as { name?: string } | undefined;
    const hist = person.employment_history as { organization_name?: string }[] | undefined;
    const city = person.city as string | undefined;
    const state = person.state as string | undefined;
    const country = person.country as string | undefined;
    const location = city ? `${city}${state ? ", " + state : ""}${country ? ", " + country : ""}` : country || "";

    const { error } = await supabase.from("candidates").insert({
      target_profile_id: job.target_profile_id || null,
      first_name: (person.first_name as string) || "",
      last_name: (person.last_name as string) || "",
      title: (person.title as string) || "",
      company: org?.name || hist?.[0]?.organization_name || "",
      linkedin_url: (person.linkedin_url as string) || null,
      email: (person.email as string) || null,
      location,
      summary: (person.headline as string) || "",
      status: "identified",
    });

    if (!error) { added++; if (linkedinUrl) existingUrls.add(linkedinUrl); }
  }

  // Marquer comme terminé
  await supabase.from("search_jobs").update({ status: "done", results_count: added }).eq("id", jobId);

  return NextResponse.json({ added, skipped, total: people.length });
}
