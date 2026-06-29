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

  // 1. Récupérer les profils cibles (filtre actif si la colonne existe)
  const { data: allProfiles, error: profilesError } = await supabase
    .from("target_profiles")
    .select("*");

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // Si la colonne "active" existe, on filtre ; sinon on prend tout
  const profiles = (allProfiles || []).filter((p) => p.active !== false);

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

      if (!apolloRes.ok) {
        const errText = await apolloRes.text();
        console.error(`[apollo] Erreur HTTP ${apolloRes.status} pour "${profile.name}":`, errText);
        continue;
      }

      const apolloData = await apolloRes.json();
      const people: Record<string, unknown>[] = apolloData.people || [];
      console.log(`[apollo] Profil "${profile.name}" → ${people.length} résultats (titres: ${titles.join(", ")})`);


      for (const person of people) {
        const p = person as Record<string, unknown> & { organization?: { name?: string }; employment_history?: { organization_name?: string }[] };
        const linkedinUrl = (p.linkedin_url as string | undefined)?.toLowerCase().trim();

        // Vérifier si déjà existant par URL LinkedIn
        if (linkedinUrl && existingLinkedInUrls.has(linkedinUrl)) {
          totalSkipped++;
          continue;
        }

        // Vérifier par nom si pas de LinkedIn
        if (!linkedinUrl) {
          const nameExists = (existingCandidates || []).some(
            (c) =>
              c.first_name?.toLowerCase() === (p.first_name as string)?.toLowerCase() &&
              c.last_name?.toLowerCase() === (p.last_name as string)?.toLowerCase()
          );
          if (nameExists) {
            totalSkipped++;
            continue;
          }
        }

        // Insérer le nouveau candidat
        const city = p.city as string | undefined;
        const state = p.state as string | undefined;
        const country = p.country as string | undefined;
        const location = city
          ? `${city}${state ? ", " + state : ""}${country ? ", " + country : ""}`
          : country || "";

        const { error: insertError } = await supabase.from("candidates").insert({
          target_profile_id: profile.id,
          first_name: (p.first_name as string) || "",
          last_name: (p.last_name as string) || "",
          title: (p.title as string) || "",
          company: p.organization?.name || p.employment_history?.[0]?.organization_name || "",
          linkedin_url: (p.linkedin_url as string) || null,
          email: (p.email as string) || null,
          location,
          summary: (p.headline as string) || "",
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
    profile_names: profiles.map((p) => p.name),
    timestamp: new Date().toISOString(),
  });
}
