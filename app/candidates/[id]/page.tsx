"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Candidate, TargetProfile, Outreach, STATUS_LABELS, STATUS_COLORS, CandidateStatus } from "@/lib/types";
import {
  ArrowLeft, ExternalLink, Copy, Check, Loader2, MessageSquare,
  ClipboardList, Trash2, Mail, Camera, Phone, Zap, Archive, ArchiveRestore
} from "lucide-react";

const STATUSES: CandidateStatus[] = ["identified", "contacted", "interview_scheduled", "selected", "rejected"];

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [profile, setProfile] = useState<TargetProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<TargetProfile[]>([]);
  const [outreaches, setOutreaches] = useState<Outreach[]>([]);
  const [interviews, setInterviews] = useState<{ id: string; created_at: string; recommendation?: string; overall_rating?: number; interview_date?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [messageTone, setMessageTone] = useState("professional");
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [enrichingLusha, setEnrichingLusha] = useState(false);
  const [lushaResult, setLushaResult] = useState<{ email?: string | null; phone?: string | null; notFound?: boolean; errorMsg?: string } | null>(null);
  const [lushaCompany, setLushaCompany] = useState("");

  async function load() {
    const { data: cand } = await supabase.from("candidates").select("*").eq("id", id).single();
    if (!cand) return;
    setCandidate(cand);
    setNotes(cand.notes || "");

    const { data: profs } = await supabase.from("target_profiles").select("*").order("name");
    setAllProfiles(profs || []);
    if (cand.target_profile_id) {
      const prof = (profs || []).find((p) => p.id === cand.target_profile_id) || null;
      setProfile(prof);
    }
    const { data: msgs } = await supabase.from("outreach").select("*").eq("candidate_id", id).order("created_at", { ascending: false });
    setOutreaches(msgs || []);
    const { data: ivs } = await supabase.from("interviews").select("id, created_at, recommendation, overall_rating, interview_date").eq("candidate_id", id).order("created_at", { ascending: false });
    setInterviews(ivs || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus(status: CandidateStatus) {
    await supabase.from("candidates").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setCandidate((prev) => prev ? { ...prev, status } : prev);
  }

  async function updateProfile(profileId: string) {
    const newProfileId = profileId || null;
    await supabase.from("candidates").update({ target_profile_id: newProfileId, updated_at: new Date().toISOString() }).eq("id", id);
    setCandidate((prev) => prev ? { ...prev, target_profile_id: newProfileId ?? undefined } : prev);
    setProfile(allProfiles.find((p) => p.id === profileId) || null);
  }

  async function saveNotes() {
    setSavingNotes(true);
    await supabase.from("candidates").update({ notes, updated_at: new Date().toISOString() }).eq("id", id);
    setSavingNotes(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !candidate) return;
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop();
    const path = `${id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("candidate-photos").upload(path, file, { upsert: true });
    if (upErr) { alert(`Erreur upload : ${upErr.message}`); setUploadingPhoto(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("candidate-photos").getPublicUrl(path);
    await supabase.from("candidates").update({ photo_url: publicUrl }).eq("id", id);
    setCandidate((prev) => prev ? { ...prev, photo_url: publicUrl } : prev);
    setUploadingPhoto(false);
  }

  async function enrichWithLusha() {
    if (!candidate) return;
    setEnrichingLusha(true);
    setLushaResult(null);
    const res = await fetch("/api/lusha-enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        company: candidate.company || lushaCompany || null,
        linkedin_url: candidate.linkedin_url,
      }),
    });
    const data = await res.json();
    setEnrichingLusha(false);
    if (data.error) { setLushaResult({ notFound: true, errorMsg: data.error }); return; }
    if (!data.email && !data.phone) {
      setLushaResult({ notFound: true });
      return;
    }
    setLushaResult({ email: data.email, phone: data.phone });
  }

  async function saveLushaData() {
    if (!lushaResult || !candidate) return;
    const updates: Record<string, string> = {};
    if (lushaResult.email) updates.email = lushaResult.email;
    if (lushaResult.phone) updates.phone = lushaResult.phone;
    await supabase.from("candidates").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    setCandidate((prev) => prev ? { ...prev, ...updates } : prev);
    setLushaResult(null);
  }

  async function generateMessage() {
    setGeneratingMsg(true);
    const res = await fetch("/api/generate-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate, targetProfile: profile, tone: messageTone }),
    });
    const data = await res.json();
    setGeneratedMessage(data.message || "");
    setGeneratingMsg(false);
  }

  async function saveOutreach() {
    if (!generatedMessage) return;
    await supabase.from("outreach").insert({
      candidate_id: id,
      message: generatedMessage,
      channel: "linkedin",
      status: "draft",
    });
    updateStatus("contacted");
    load();
  }

  function copyMessage() {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteCandidate() {
    if (!confirm("Supprimer définitivement ce candidat ?")) return;
    await supabase.from("outreach").delete().eq("candidate_id", id);
    await supabase.from("competency_scores").delete().in(
      "interview_id",
      (await supabase.from("interviews").select("id").eq("candidate_id", id)).data?.map((i) => i.id) || []
    );
    await supabase.from("interviews").delete().eq("candidate_id", id);
    await supabase.from("candidates").delete().eq("id", id);
    router.push("/candidates");
  }

  if (loading) return <div className="p-8 text-slate-400">Chargement...</div>;
  if (!candidate) return <div className="p-8 text-slate-500">Candidat introuvable</div>;

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/candidates" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* Avatar avec upload */}
        <label className="relative cursor-pointer group flex-shrink-0">
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          {candidate.photo_url ? (
            <img src={candidate.photo_url} alt={`${candidate.first_name} ${candidate.last_name}`}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-slate-100" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xl font-bold">
              {candidate.first_name[0]}{candidate.last_name[0]}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploadingPhoto ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
          </div>
        </label>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{candidate.first_name} {candidate.last_name}</h1>
          <p className="text-slate-500 mt-0.5">{candidate.title}{candidate.company ? ` · ${candidate.company}` : ""}</p>
        </div>
        <button
          onClick={async () => {
            await supabase.from("candidates").update({ archived: !candidate.archived }).eq("id", id);
            setCandidate((prev) => prev ? { ...prev, archived: !prev.archived } : prev);
          }}
          title={candidate.archived ? "Désarchiver" : "Archiver"}
          className="text-slate-300 hover:text-amber-500 transition-colors"
        >
          {candidate.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
        </button>
        <button onClick={deleteCandidate} className="text-slate-300 hover:text-red-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {candidate.archived && (
        <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
          <Archive className="w-4 h-4" /> Ce candidat est archivé — il n&apos;apparaît plus dans la liste principale.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-1 space-y-4">
          {/* Info card */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Informations</h3>
            {candidate.location && (
              <div className="text-sm text-slate-600">{candidate.location}</div>
            )}
            {candidate.email && (
              <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
                <Mail className="w-4 h-4" /> {candidate.email}
              </a>
            )}
            {candidate.phone && (
              <a href={`tel:${candidate.phone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:underline">
                <Phone className="w-4 h-4 text-slate-400" /> {candidate.phone}
              </a>
            )}
            {/* Bouton Lusha */}
            {(!candidate.email || !candidate.phone) && !lushaResult && (
              <div className="space-y-2">
                {!candidate.company && (
                  <input
                    className="input text-xs"
                    placeholder="Entreprise (requis par Lusha)..."
                    value={lushaCompany}
                    onChange={(e) => setLushaCompany(e.target.value)}
                  />
                )}
                <button
                  onClick={enrichWithLusha}
                  disabled={enrichingLusha || (!candidate.company && !lushaCompany)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-xs font-medium hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enrichingLusha ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {enrichingLusha ? "Recherche Lusha..." : "Enrichir avec Lusha"}
                </button>
              </div>
            )}

            {/* Résultat Lusha */}
            {lushaResult && (
              <div className={`rounded-lg border p-3 text-xs ${lushaResult.notFound ? "bg-slate-50 border-slate-200 text-slate-500" : "bg-emerald-50 border-emerald-200"}`}>
                {lushaResult.notFound ? (
                  <div className="flex items-start gap-2 text-slate-500">
                    <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{lushaResult.errorMsg || "Aucun résultat trouvé dans Lusha"}</span>
                  </div>
                ) : (
                  <>
                    <div className="font-medium text-emerald-700 mb-2 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Lusha a trouvé :
                    </div>
                    {lushaResult.email && (
                      <div className="flex items-center gap-1.5 text-slate-700 mb-1">
                        <Mail className="w-3 h-3 text-slate-400" /> {lushaResult.email}
                      </div>
                    )}
                    {lushaResult.phone && (
                      <div className="flex items-center gap-1.5 text-slate-700 mb-2">
                        <Phone className="w-3 h-3 text-slate-400" /> {lushaResult.phone}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button onClick={saveLushaData} className="flex-1 py-1.5 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors">
                        Enregistrer
                      </button>
                      <button onClick={() => setLushaResult(null)} className="px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                        Ignorer
                      </button>
                    </div>
                  </>
                )}
                {lushaResult.notFound && (
                  <button onClick={() => setLushaResult(null)} className="mt-2 text-slate-400 hover:text-slate-600 underline">Fermer</button>
                )}
              </div>
            )}
            {candidate.linkedin_url && (
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="w-4 h-4" /> Profil LinkedIn
              </a>
            )}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-400 mb-1.5">Profil cible</div>
              <select
                className="input text-sm"
                value={candidate.target_profile_id || ""}
                onChange={(e) => updateProfile(e.target.value)}
              >
                <option value="">— Non rattaché —</option>
                {allProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {profile && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.competencies.slice(0, 4).map((c) => (
                    <span key={c} className="text-xs px-1.5 py-0.5 bg-primary-50 text-primary-700 rounded-full">{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Statut</h3>
            <div className="space-y-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    candidate.status === s
                      ? STATUS_COLORS[s] + " ring-2 ring-offset-1 ring-current"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Entretiens */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary-600" /> Entretiens
            </h3>
            {interviews.length > 0 && (
              <div className="space-y-2 mb-3">
                {interviews.map((iv) => (
                  <Link
                    key={iv.id}
                    href={`/interview/${iv.id}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="text-xs text-slate-600">
                      {iv.interview_date
                        ? new Date(iv.interview_date).toLocaleDateString("fr-FR")
                        : new Date(iv.created_at).toLocaleDateString("fr-FR")}
                    </div>
                    <div className="flex items-center gap-2">
                      {iv.overall_rating ? (
                        <span className="text-xs text-amber-600 font-medium">{iv.overall_rating}/5</span>
                      ) : null}
                      {iv.recommendation && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          iv.recommendation === "go" ? "bg-emerald-100 text-emerald-700" :
                          iv.recommendation === "no_go" ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {iv.recommendation === "go" ? "Go" : iv.recommendation === "no_go" ? "No Go" : "À revoir"}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link
              href={`/interview/new?candidateId=${id}`}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <ClipboardList className="w-4 h-4" /> Nouvel entretien
            </Link>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-2 space-y-4">
          {/* Notes */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Notes</h3>
            <textarea
              className="input h-28 resize-none text-sm"
              placeholder="Notes sur le candidat..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button onClick={saveNotes} disabled={savingNotes} className="btn-primary mt-2 text-sm">
              {savingNotes ? "Enregistrement..." : "Sauvegarder"}
            </button>
          </div>

          {/* Message generator */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-primary-600" />
              <h3 className="text-sm font-semibold text-slate-700">Message LinkedIn personnalisé</h3>
            </div>
            <div className="flex gap-2 mb-3">
              {[
                { value: "professional", label: "Professionnel" },
                { value: "friendly", label: "Chaleureux" },
                { value: "concise", label: "Concis" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setMessageTone(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    messageTone === value
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={generateMessage}
              disabled={generatingMsg}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              {generatingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              {generatingMsg ? "Génération en cours..." : "Générer un message"}
            </button>

            {generatedMessage && (
              <div className="mt-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
                  {generatedMessage}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={copyMessage} className="btn-secondary text-sm flex items-center gap-2">
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copié !" : "Copier"}
                  </button>
                  <button onClick={saveOutreach} className="btn-primary text-sm">
                    Marquer comme envoyé
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Outreach history */}
          {outreaches.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Historique des contacts</h3>
              <div className="space-y-3">
                {outreaches.map((o) => (
                  <div key={o.id} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        o.status === "replied" ? "bg-emerald-100 text-emerald-700" :
                        o.status === "sent" ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {o.status === "draft" ? "Brouillon" :
                         o.status === "sent" ? "Envoyé" :
                         o.status === "replied" ? "Répondu" : "Sans réponse"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(o.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-3">{o.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
