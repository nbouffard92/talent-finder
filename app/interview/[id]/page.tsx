"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Candidate, TargetProfile, Interview, CompetencyScore } from "@/lib/types";
import { ArrowLeft, Star, Loader2, Brain, Check, ExternalLink } from "lucide-react";

const DEFAULT_COMPETENCIES = [
  "Expertise technique",
  "Communication",
  "Résolution de problèmes",
  "Travail en équipe",
  "Leadership",
  "Adaptabilité",
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="transition-colors"
        >
          <Star
            className={`w-6 h-6 ${n <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [profile, setProfile] = useState<TargetProfile | null>(null);
  const [competencies, setCompetencies] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, { score: number; comment: string }>>({});
  const [notes, setNotes] = useState("");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [culturalFit, setCulturalFit] = useState(0);
  const [overallRating, setOverallRating] = useState(0);
  const [recommendation, setRecommendation] = useState<"go" | "no_go" | "maybe" | "">("");
  const [interviewDate, setInterviewDate] = useState("");
  const [salaryExpectation, setSalaryExpectation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: iv } = await supabase.from("interviews").select("*").eq("id", id).single();
      if (!iv) return;
      setInterview(iv);
      setInterviewDate(iv.interview_date || "");
      setSalaryExpectation(iv.salary_expectation ? String(iv.salary_expectation) : "");
      setNotes(iv.notes || "");
      setStrengths(iv.strengths || "");
      setWeaknesses(iv.weaknesses || "");
      setCulturalFit(iv.cultural_fit || 0);
      setOverallRating(iv.overall_rating || 0);
      setRecommendation(iv.recommendation || "");
      setSummary(iv.ai_summary || "");

      const { data: cand } = await supabase.from("candidates").select("*").eq("id", iv.candidate_id).single();
      if (cand) {
        setCandidate(cand);
        if (cand.target_profile_id) {
          const { data: prof } = await supabase.from("target_profiles").select("*").eq("id", cand.target_profile_id).single();
          if (prof) {
            setProfile(prof);
            setCompetencies(prof.competencies.length > 0 ? prof.competencies : DEFAULT_COMPETENCIES);
          } else {
            setCompetencies(DEFAULT_COMPETENCIES);
          }
        } else {
          setCompetencies(DEFAULT_COMPETENCIES);
        }
      }

      const { data: existingScores } = await supabase.from("competency_scores").select("*").eq("interview_id", id);
      if (existingScores && existingScores.length > 0) {
        const mapped: Record<string, { score: number; comment: string }> = {};
        existingScores.forEach((s: CompetencyScore) => {
          mapped[s.competency] = { score: s.score, comment: s.comment || "" };
        });
        setScores(mapped);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  function setScore(competency: string, score: number) {
    setScores((prev) => ({ ...prev, [competency]: { ...prev[competency], score, comment: prev[competency]?.comment || "" } }));
  }

  function setComment(competency: string, comment: string) {
    setScores((prev) => ({ ...prev, [competency]: { ...prev[competency], comment, score: prev[competency]?.score || 0 } }));
  }

  async function handleSave() {
    setSaving(true);
    const { error: ivError } = await supabase.from("interviews").update({
      interview_date: interviewDate || null,
      salary_expectation: salaryExpectation ? parseInt(salaryExpectation) : null,
      notes,
      strengths,
      weaknesses,
      cultural_fit: culturalFit || null,
      overall_rating: overallRating || null,
      recommendation: recommendation || null,
      ai_summary: summary || null,
    }).eq("id", id);

    if (ivError) {
      alert(`Erreur sauvegarde entretien : ${ivError.message}`);
      setSaving(false);
      return;
    }

    const { error: delError } = await supabase.from("competency_scores").delete().eq("interview_id", id);
    if (delError) {
      alert(`Erreur suppression scores : ${delError.message}`);
      setSaving(false);
      return;
    }

    const scoreRows = competencies
      .filter((c) => scores[c]?.score > 0)
      .map((c) => ({
        interview_id: id,
        competency: c,
        score: scores[c].score,
        comment: scores[c].comment || null,
      }));

    if (scoreRows.length > 0) {
      const { error: insError } = await supabase.from("competency_scores").insert(scoreRows);
      if (insError) {
        alert(`Erreur sauvegarde scores : ${insError.message}`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function generateSummary() {
    if (!candidate) return;
    setGeneratingSummary(true);
    try {
      const scoresList = competencies
        .filter((c) => scores[c]?.score > 0)
        .map((c) => ({ competency: c, score: scores[c].score, comment: scores[c].comment }));
      const res = await fetch("/api/interview-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate, competencyScores: scoresList, notes, strengths, weaknesses, culturalFit, overallRating }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Erreur synthèse IA : ${data.error}`);
      } else {
        setSummary(data.summary || "");
      }
    } catch (err) {
      alert(`Erreur : ${String(err)}`);
    } finally {
      setGeneratingSummary(false);
    }
  }

  const avgScore =
    competencies.filter((c) => scores[c]?.score > 0).length > 0
      ? (competencies.reduce((acc, c) => acc + (scores[c]?.score || 0), 0) /
          competencies.filter((c) => scores[c]?.score > 0).length)
      : 0;

  if (loading) return <div className="p-8 text-slate-400">Chargement...</div>;
  if (!candidate) return <div className="p-8 text-slate-500">Entretien introuvable</div>;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/candidates/${candidate.id}`} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              Entretien — {candidate.first_name} {candidate.last_name}
            </h1>
            {candidate.linkedin_url && (
              <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          <p className="text-slate-500">{candidate.title}{candidate.company ? ` · ${candidate.company}` : ""}</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? "Sauvegardé !" : "Sauvegarder"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Competency grid */}
        <div className="col-span-2 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-900">Grille de compétences</h2>
              {avgScore > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Moyenne :</span>
                  <span className="text-lg font-bold text-slate-900">{avgScore.toFixed(1)}/5</span>
                </div>
              )}
            </div>
            <div className="space-y-5">
              {competencies.map((comp) => (
                <div key={comp} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-800">{comp}</label>
                    <StarRating value={scores[comp]?.score || 0} onChange={(v) => setScore(comp, v)} />
                  </div>
                  <input
                    className="input text-sm"
                    placeholder="Commentaire (optionnel)..."
                    value={scores[comp]?.comment || ""}
                    onChange={(e) => setComment(comp, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Notes d&apos;entretien</h2>
            <textarea
              className="input h-32 resize-none text-sm"
              placeholder="Notes libres pendant l'entretien..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* AI Summary */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold text-slate-900">Synthèse IA</h2>
            </div>
            <button
              onClick={generateSummary}
              disabled={generatingSummary}
              className="btn-primary w-full flex items-center justify-center gap-2 mb-4"
            >
              {generatingSummary ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {generatingSummary ? "Génération en cours..." : "Générer la synthèse"}
            </button>
            {summary && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {summary}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="col-span-1 space-y-4">
          {/* Date et salaire */}
          <div className="card p-5 space-y-4">
            <div>
              <label className="label">Date de l&apos;entretien</label>
              <input
                type="date"
                className="input"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Prétention salariale (k€/an)</label>
              <input
                type="number"
                className="input"
                placeholder="ex: 75"
                value={salaryExpectation}
                onChange={(e) => setSalaryExpectation(e.target.value)}
              />
            </div>
          </div>
          {/* Strengths/weaknesses */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Points forts</h3>
            <textarea
              className="input h-24 resize-none text-sm"
              placeholder="Points forts du candidat..."
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
            />
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Points d&apos;attention</h3>
            <textarea
              className="input h-24 resize-none text-sm"
              placeholder="Points à améliorer ou risques..."
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
            />
          </div>

          {/* Global ratings */}
          <div className="card p-5 space-y-4">
            <div>
              <label className="label">Fit culturel</label>
              <StarRating value={culturalFit} onChange={setCulturalFit} />
            </div>
            <div>
              <label className="label">Note globale</label>
              <StarRating value={overallRating} onChange={setOverallRating} />
            </div>
          </div>

          {/* Recommendation */}
          <div className="card p-5">
            <label className="label">Recommandation</label>
            <div className="space-y-2">
              {[
                { value: "go", label: "Go", color: "border-emerald-500 bg-emerald-50 text-emerald-700" },
                { value: "maybe", label: "À revoir", color: "border-amber-500 bg-amber-50 text-amber-700" },
                { value: "no_go", label: "No Go", color: "border-red-500 bg-red-50 text-red-700" },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => setRecommendation(value as "go" | "no_go" | "maybe")}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    recommendation === value ? color : "border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {profile && profile.competencies.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Compétences attendues</h3>
              <div className="flex flex-wrap gap-1">
                {profile.competencies.map((c) => (
                  <span key={c} className="text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
