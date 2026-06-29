"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { TargetProfile } from "@/lib/types";
import { Plus, Trash2, ExternalLink, Target, X, Pencil, Linkedin, Sparkles, Power, Bot } from "lucide-react";

const EMPTY_FORM = { name: "", title: "", linkedin_url: "", description: "", competencies_raw: "" };

type LinkedInStep = "url" | "analyzing" | "review";

export default function TargetsPage() {
  const [profiles, setProfiles] = useState<TargetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // LinkedIn flow state
  const [liStep, setLiStep] = useState<LinkedInStep>("url");
  const [liUrl, setLiUrl] = useState("");
  const [liError, setLiError] = useState("");

  async function load() {
    const { data } = await supabase.from("target_profiles").select("*").order("created_at", { ascending: false });
    setProfiles(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p: TargetProfile) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      title: p.title,
      linkedin_url: p.linkedin_url || "",
      description: p.description || "",
      competencies_raw: p.competencies.join(", "),
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function openLinkedIn() {
    setLiStep("url");
    setLiUrl("");
    setLiError("");
    setShowLinkedIn(true);
  }

  function closeLinkedIn() {
    setShowLinkedIn(false);
  }

  async function handleAnalyze() {
    if (!liUrl.trim()) { setLiError("Entrez l'URL LinkedIn"); return; }
    setLiError("");
    setLiStep("analyzing");

    try {
      const res = await fetch("/api/analyze-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_url: liUrl }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setLiError(data.error || "Erreur lors de l'analyse");
        setLiStep("url");
        return;
      }
      setForm({
        name: data.suggested_name || "",
        title: data.title || "",
        linkedin_url: liUrl,
        description: data.description || "",
        competencies_raw: (data.competencies || []).join(", "),
      });
      setLiStep("review");
    } catch (err) {
      setLiError(String(err));
      setLiStep("url");
    }
  }

  async function handleSave() {
    if (!form.name || !form.title) return;
    setSaving(true);
    const competencies = form.competencies_raw.split(",").map((c) => c.trim()).filter(Boolean);
    const payload = {
      name: form.name,
      title: form.title,
      linkedin_url: form.linkedin_url || null,
      description: form.description || null,
      competencies,
    };

    if (editingId) {
      await supabase.from("target_profiles").update(payload).eq("id", editingId);
    } else {
      await supabase.from("target_profiles").insert(payload);
    }

    setSaving(false);
    closeForm();
    if (showLinkedIn) closeLinkedIn();
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce profil cible ?")) return;
    await supabase.from("target_profiles").delete().eq("id", id);
    load();
  }

  async function toggleActive(p: TargetProfile) {
    await supabase.from("target_profiles").update({ active: !p.active }).eq("id", p.id);
    load();
  }

  const [agentRunning, setAgentRunning] = useState(false);
  const [agentResult, setAgentResult] = useState<{ added: number; skipped: number } | null>(null);

  async function runAgent() {
    setAgentRunning(true);
    setAgentResult(null);
    try {
      const res = await fetch("/api/linkedin-agent", { method: "POST" });
      const data = await res.json();
      setAgentResult({ added: data.added || 0, skipped: data.skipped || 0 });
    } catch {
      setAgentResult({ added: 0, skipped: 0 });
    }
    setAgentRunning(false);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profils cibles</h1>
          <p className="text-slate-500 mt-1">Les postes à renforcer dans votre équipe</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAgent}
            disabled={agentRunning}
            className="btn-secondary flex items-center gap-2"
            title="Lancer l'agent pour chercher de nouveaux candidats sur les profils actifs"
          >
            <Bot className={`w-4 h-4 text-indigo-600 ${agentRunning ? "animate-spin" : ""}`} />
            {agentRunning ? "Agent en cours..." : "Lancer l'agent"}
          </button>
          <button onClick={openLinkedIn} className="btn-secondary flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-blue-600" />
            Créer depuis LinkedIn
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau profil
          </button>
        </div>
      </div>

      {/* ── Modal LinkedIn flow ── */}
      {showLinkedIn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-500" />
                <h2 className="font-semibold text-slate-900">
                  {liStep === "review" ? "Profil généré — vérifiez et nommez" : "Créer un profil cible depuis LinkedIn"}
                </h2>
              </div>
              <button onClick={closeLinkedIn} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step: URL */}
            {liStep === "url" && (
              <div className="p-6 space-y-5">
                <div>
                  <label className="label">URL LinkedIn du profil de référence</label>
                  <input
                    className="input"
                    placeholder="https://www.linkedin.com/in/prenom-nom/"
                    value={liUrl}
                    onChange={(e) => setLiUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && liUrl && handleAnalyze()}
                    autoFocus
                  />
                </div>
                {liError && (
                  <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
                    {liError}
                  </div>
                )}
                <div className="flex justify-between">
                  <button onClick={closeLinkedIn} className="btn-secondary">Annuler</button>
                  <button onClick={handleAnalyze} disabled={!liUrl.trim()} className="btn-primary flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Analyser avec Claude
                  </button>
                </div>
              </div>
            )}

            {/* Step: Analyzing */}
            {liStep === "analyzing" && (
              <div className="p-12 flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary-500 animate-pulse" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Analyse en cours...</p>
                  <p className="text-sm text-slate-400 mt-1">Claude analyse le profil et génère le profil cible</p>
                </div>
              </div>
            )}

            {/* Step: Review */}
            {liStep === "review" && (
              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  Profil généré — vérifiez et ajustez avant d&apos;enregistrer
                </div>

                <div>
                  <label className="label">Nom du profil cible *</label>
                  <input className="input" placeholder="Ex : DG ESN Tech" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                </div>
                <div>
                  <label className="label">Mots-clés pour la recherche LinkedIn *</label>
                  <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className="label">URL LinkedIn de référence</label>
                  <input className="input" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} />
                </div>
                <div>
                  <label className="label">Compétences clés</label>
                  <input className="input" value={form.competencies_raw} onChange={(e) => setForm({ ...form, competencies_raw: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Séparées par des virgules</p>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input h-20 resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <button onClick={() => { setLiStep("url"); setLiError(""); }} className="btn-secondary flex items-center gap-1.5">
                    ← Ré-analyser
                  </button>
                  <div className="flex gap-2">
                    <button onClick={closeLinkedIn} className="btn-secondary">Annuler</button>
                    <button onClick={handleSave} disabled={saving || !form.name || !form.title} className="btn-primary">
                      {saving ? "Enregistrement..." : "Enregistrer le profil"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal création / édition manuelle ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">
                {editingId ? "Modifier le profil cible" : "Nouveau profil cible"}
              </h2>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nom du poste *</label>
                <input className="input" placeholder="Ex : Architecte Cloud AWS Senior" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Titre LinkedIn à rechercher *</label>
                <input className="input" placeholder="Ex : Cloud Architect, AWS Solutions Architect" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">URL LinkedIn d&apos;un collaborateur de référence</label>
                <input className="input" placeholder="https://www.linkedin.com/in/..." value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} />
              </div>
              <div>
                <label className="label">Compétences clés (séparées par des virgules)</label>
                <input className="input" placeholder="AWS, Terraform, Kubernetes, Architecture Cloud" value={form.competencies_raw} onChange={(e) => setForm({ ...form, competencies_raw: e.target.value })} />
              </div>
              <div>
                <label className="label">Description / contexte</label>
                <textarea className="input h-20 resize-none" placeholder="Contexte du recrutement, niveau d'expérience attendu..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={closeForm} className="btn-secondary">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.title} className="btn-primary">
                {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Résultat agent */}
      {agentResult && (
        <div className="mb-6 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700 flex items-center gap-2">
          <Bot className="w-4 h-4 flex-shrink-0" />
          Agent terminé — <strong>{agentResult.added} nouveaux candidats</strong> ajoutés, {agentResult.skipped} déjà existants ignorés.
          <button onClick={() => setAgentResult(null)} className="ml-auto text-indigo-400 hover:text-indigo-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Liste des profils ── */}
      {loading ? (
        <div className="text-slate-400 text-sm">Chargement...</div>
      ) : profiles.length === 0 ? (
        <div className="card p-12 text-center">
          <Target className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun profil cible</p>
          <p className="text-slate-400 text-sm mt-1">Commencez par définir les postes à pourvoir</p>
          <div className="flex justify-center gap-3 mt-4">
            <button onClick={openLinkedIn} className="btn-secondary inline-flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-blue-600" /> Créer depuis LinkedIn
            </button>
            <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Créer manuellement
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {profiles.map((p) => (
            <div key={p.id} className={`card p-5 ${!p.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{p.title}</p>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(p)}
                    title={p.active ? "Désactiver (l'agent ignorera ce profil)" : "Activer (l'agent cherchera des candidats)"}
                    className={`p-1.5 rounded-lg transition-colors ${p.active ? "text-emerald-500 hover:text-slate-400 hover:bg-slate-50" : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50"}`}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(p)} className="p-1.5 text-slate-300 hover:text-primary-600 transition-colors rounded-lg hover:bg-primary-50">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {p.competencies.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.competencies.map((c) => (
                    <span key={c} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full font-medium">{c}</span>
                  ))}
                </div>
              )}
              {p.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                {p.linkedin_url && (
                  <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Profil LinkedIn
                  </a>
                )}
                <a href={`/sourcing?profile=${p.id}`} className="ml-auto text-xs text-primary-600 font-medium hover:underline">
                  Lancer une recherche →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
