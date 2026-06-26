"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Candidate, TargetProfile } from "@/lib/types";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

function NewInterviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const candidateId = searchParams.get("candidateId");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!candidateId) return;
    supabase.from("candidates").select("*, target_profile:target_profiles(*)").eq("id", candidateId).single()
      .then(({ data }) => setCandidate(data));
  }, [candidateId]);

  async function createInterview() {
    if (!candidateId) return;
    setCreating(true);
    const { data, error } = await supabase.from("interviews").insert({ candidate_id: candidateId }).select().single();
    if (error || !data) {
      alert(`Erreur : ${error?.message || "Insert échoué"}`);
      setCreating(false);
      return;
    }
    await supabase.from("candidates").update({ status: "interview_scheduled", updated_at: new Date().toISOString() }).eq("id", candidateId);
    router.push(`/interview/${data.id}`);
  }

  if (!candidate) return <div className="p-8 text-slate-400">Chargement...</div>;

  return (
    <div className="p-8 max-w-lg">
      <Link href={`/candidates/${candidateId}`} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Retour au candidat
      </Link>
      <div className="card p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
          {candidate.first_name[0]}{candidate.last_name[0]}
        </div>
        <h1 className="text-xl font-bold text-slate-900">{candidate.first_name} {candidate.last_name}</h1>
        <p className="text-slate-500 mt-1 mb-6">{candidate.title}{candidate.company ? ` · ${candidate.company}` : ""}</p>
        <button onClick={createInterview} disabled={creating} className="btn-primary flex items-center gap-2 mx-auto">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Démarrer l&apos;entretien
        </button>
      </div>
    </div>
  );
}

export default function NewInterviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Chargement...</div>}>
      <NewInterviewContent />
    </Suspense>
  );
}
