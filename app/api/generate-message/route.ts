import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { candidate, targetProfile, tone } = await req.json();

  const candidateName = `${candidate.first_name} ${candidate.last_name}`;
  const candidateTitle = candidate.title || "professionnel";
  const candidateCompany = candidate.company || "votre entreprise actuelle";
  const targetName = targetProfile?.name || "un poste de consultant Cloud";
  const competencies = targetProfile?.competencies?.join(", ") || "";

  const toneMap: Record<string, string> = {
    professional: "professionnel et direct",
    friendly: "chaleureux et conversationnel",
    concise: "très court (4-5 lignes maximum)",
  };

  const prompt = `Tu es un directeur général d'une société de conseil IT (Devoteam Cloud) en train de recruter.
Tu dois rédiger un message LinkedIn de prise de contact pour ${candidateName}, actuellement ${candidateTitle} chez ${candidateCompany}.
Tu recrutes pour : ${targetName}.
${competencies ? `Compétences recherchées : ${competencies}` : ""}

Ton du message : ${toneMap[tone] || toneMap.professional}

Consignes :
- Message en français
- Maximum 150 mots
- Personnel et non-générique
- Mentionne un élément concret du profil du candidat
- Ne pas utiliser "Je me permets de vous contacter"
- Conclure avec une invitation à échanger (pas de question fermée)
- Signe avec "Nicolas Bouffard, Directeur Général Devoteam Cloud"

Rédige uniquement le message LinkedIn, sans commentaire.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return NextResponse.json({ message: text });
}
