import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { candidate, competencyScores, notes, strengths, weaknesses, culturalFit, overallRating } = await req.json();

  const scoresText = competencyScores
    .map((s: { competency: string; score: number; comment?: string }) =>
      `- ${s.competency}: ${s.score}/5${s.comment ? ` (${s.comment})` : ""}`
    )
    .join("\n");

  const prompt = `Tu es un assistant RH. Analyse cet entretien et rédige une synthèse professionnelle en français.

Candidat : ${candidate.first_name} ${candidate.last_name}
Poste : ${candidate.title || "N/A"}

Compétences évaluées :
${scoresText}

Notes d'entretien : ${notes || "Aucune"}
Points forts : ${strengths || "Non renseigné"}
Points faibles : ${weaknesses || "Non renseigné"}
Fit culturel : ${culturalFit}/5
Note globale : ${overallRating}/5

Rédige une synthèse structurée avec :
1. **Profil en bref** (2-3 phrases)
2. **Points forts** (bullet points)
3. **Points d'attention** (bullet points)
4. **Conclusion et recommandation** (Go / No Go / À revoir, avec justification courte)

Sois direct et factuel. Maximum 300 mots.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ summary: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[interview-summary] Erreur:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
