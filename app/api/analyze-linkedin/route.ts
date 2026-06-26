import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchLinkedInProfile(url: string): Promise<string> {
  // Try fetching the public LinkedIn page
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  if (!res.ok) return "";

  const html = await res.text();

  // Extract JSON-LD structured data (LinkedIn embeds profile data here)
  const jsonLdBlocks: string[] = Array.from(
    html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
    (m) => m[1]
  );

  // Extract og: meta tags
  const ogTags: string[] = Array.from(
    html.matchAll(/<meta[^>]*property="og:([^"]+)"[^>]*content="([^"]*)"[^>]*>/gi),
    (m) => `${m[1]}: ${m[2]}`
  );

  // Extract visible text from key sections (title, description)
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);

  const parts = [];
  if (titleMatch) parts.push(`Titre page: ${titleMatch[1]}`);
  if (descMatch) parts.push(`Description: ${descMatch[1]}`);
  if (ogTags.length) parts.push(`Open Graph:\n${ogTags.join("\n")}`);
  if (jsonLdBlocks.length) parts.push(`JSON-LD:\n${jsonLdBlocks.slice(0, 3).join("\n\n")}`);

  return parts.join("\n\n");
}

export async function POST(req: NextRequest) {
  const { linkedin_url } = await req.json();

  if (!linkedin_url || !linkedin_url.includes("linkedin.com/in/")) {
    return NextResponse.json({ error: "URL LinkedIn invalide" }, { status: 400 });
  }

  // Extract username from URL for fallback context
  const username = linkedin_url.replace(/.*\/in\//, "").replace(/\/$/, "").replace(/-/g, " ");

  let profileContext = `URL LinkedIn : ${linkedin_url}\nIdentifiant : ${username}`;

  try {
    const fetched = await fetchLinkedInProfile(linkedin_url);
    if (fetched && fetched.length > 100) {
      profileContext += `\n\nContenu extrait du profil :\n${fetched.slice(0, 5000)}`;
    }
  } catch {
    // Fetch failed — continue with URL only
  }

  const prompt = `Tu es un expert en recrutement de cadres dirigeants. Analyse ce profil LinkedIn et génère un profil cible de recrutement.

${profileContext}

En te basant sur les informations disponibles (et tes connaissances si tu connais cette personne), génère un profil cible pour recruter des profils similaires. Base-toi PRINCIPALEMENT sur le poste le plus récent.

RÈGLES :
- suggested_name : court, mémorable (ex: "DG ESN Tech", "VP Sales SaaS", "CDO Retail")
- title : mots-clés LinkedIn optimisés pour la recherche (titres courants, séparés par virgules)
- description : 2-3 phrases sur le niveau attendu, secteur, contexte d'entreprise, responsabilités clés
- competencies : 6 à 10 compétences/expertises (soft + hard skills, secteurs, outils)

Réponds UNIQUEMENT avec du JSON valide (sans markdown, sans backticks) :
{
  "suggested_name": "...",
  "title": "...",
  "description": "...",
  "competencies": ["...", "...", "..."]
}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON introuvable dans la réponse");

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze-linkedin]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
