import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
  const apolloKey = process.env.APOLLO_API_KEY;
  if (!apolloKey) {
    return NextResponse.json({ error: "Apollo API key non configurée" }, { status: 500 });
  }

  // 1. Récupérer les profils cibles actifs
  const { data: profiles, error: profilesError } = await supabase
    .from("target_profiles")
    .select("*")
    .eq("active", true);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ added: 0, skipped: 0, message: "Aucun profil cible actif" });
  }

  // 2. Récupérer les LinkedIn URLs existants pour dédupliquer
  const { data: existingCandidates } = await supabase
    .from("candidates")
    .select("linkedin_url, first_name, last_name");

  const existingLinkedInUrls = new Set(
    (existingCandidates || [])
      .map((c) => c.linkedin_url)
      .filter(Boolean)
      .map((u) => u.toLowerCase().trim())
  );

  let totalAdded = 0;
  let totalSkipped = 0;

  // 3. Pour chaque profil actif, chercher des candidats via Apollo
  for (const profile of profiles) {
    try {
      const titles = profile.title
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);

      const keywords = profile.competencies?.slice(0, 5).join(" ") || "";

      const apolloBody = {
        page: 1,
        per_page: 20,
        person_titles: titles,
        q_keywords: keywords,
        person_locations: ["France"],
        contact_email_status: ["verified", "likely to engage"],
      };

      const apolloRes = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apolloKey,
        },
        body: JSON.stringify(apolloBody),
      });

      if (!apolloRes.ok) continue;

      const apolloData = await apolloRes.json();
      const people = apolloData.people || [];

      for (const person of people) {
        const linkedinUrl = person.linkedin_url?.toLowerCase().trim();

        // Vérifier si déjà existant par URL LinkedIn
        if (linkedinUrl && existingLinkedInUrls.has(linkedinUrl)) {
          totalSkipped++;
          continue;
        }

        // Vérifier par nom si pas de LinkedIn
        if (!linkedinUrl) {
          const nameExists = (existingCandidates || []).some(
            (c) =>
              c.first_name?.toLowerCase() === person.first_name?.toLowerCase() &&
              c.last_name?.toLowerCase() === person.last_name?.toLowerCase()
          );
          if (nameExists) {
            totalSkipped++;
            continue;
          }
        }

        // Insérer le nouveau candidat
        const location = person.city
          ? `${person.city}${person.state ? ", " + person.state : ""}${person.country ? ", " + person.country : ""}`
          : person.country || "";

        const { error: insertError } = await supabase.from("candidates").insert({
          target_profile_id: profile.id,
          first_name: person.first_name || "",
          last_name: person.last_name || "",
          title: person.title || "",
          company: person.organization?.name || person.employment_history?.[0]?.organization_name || "",
          linkedin_url: person.linkedin_url || null,
          email: person.email || null,
          location,
          summary: person.headline || "",
          status: "identified",
        });

        if (!insertError) {
          totalAdded++;
          if (linkedinUrl) existingLinkedInUrls.add(linkedinUrl);
        }
      }

      // Pause entre les appels Apollo pour éviter le rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`[linkedin-agent] Erreur pour profil ${profile.name}:`, err);
    }
  }

  return NextResponse.json({
    added: totalAdded,
    skipped: totalSkipped,
    profiles_processed: profiles.length,
    timestamp: new Date().toISOString(),
  });
}
