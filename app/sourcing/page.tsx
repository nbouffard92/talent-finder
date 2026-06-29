"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TargetProfile } from "@/lib/types";
import { Search, UserPlus, ExternalLink, Linkedin, X, Zap, Clock, CheckCircle, Play, Users } from "lucide-react";

interface SearchJob {
  id: string;
  target_profile_id?: string;
  titles: string[];
  keywords?: string;
  location?: string;
  status: "pending" | "running" | "done";
  results_count: number;
  created_at: string;
}

function SourcingContent() {
  const searchParams = useSearchParams();
  const [profiles, setProfiles] = useState<TargetProfile[]>([]);
  const [tab, setTab] = useState<"auto" | "manual">("auto");

  // Auto search
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [searchTitles, setSearchTitles] = useState("");
  const [searchKeywords, setSearchKeywords] = useState("");
  const [searchLocation, setSearchLocation] = useState("France");
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<{ jobId: string; added: number; skipped: number } | null>(null);

  // Manual import
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importForm, setImportForm] = useState({
    first_name: "", last_name: "", title: "", company: "", location: "", email: "",
  });
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [manualTitles, setManualTitles] = useState("");
  const [manualKeywords, setManualKeywords] = useState("");
  const [manualLocation, setManualLocation] = useState("France");

  useEffect(() => {
    supabase.from("target_profiles").select("*").order("created_at", { ascending: false })
      .then(({ data }) => {
        setProfiles(data || []);
        const paramProfile = searchParams.get("profile");
        if (paramProfile && data?.find((p) => p.id === paramProfile)) {
          setSelectedProfile(paramProfile);
          const prof = data.find((p) => p.id === paramProfile);
          if (prof) {
            setSearchTitles(prof.title);
            setSearchKeywords(prof.competencies.join(", "));
          }
        }
      });
    loadJobs();
  }, [searchParams]);

  async function loadJobs() {
    const { data } = await supabase.from("search_jobs").select("*").order("created_at", { ascending: false }).limit(10);
    setJobs(data || []);
  }

  async function runJob(jobId: string) {
    setRunningJobId(jobId);
    setJobResult(null);
    loadJobs();
    const res = await fetch("/api/run-search-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    const data = await res.json();
    setRunningJobId(null);
    if (res.ok) setJobResult({ jobId, added: data.added, skipped: data.skipped });
    loadJobs();
  }

  function handleProfileSelect(id: string) {
    setSelectedProfile(id);
    const prof = profiles.find((p) => p.id === id);
    if (prof) {
      setSearchTitles(prof.title);
      setSearchKeywords(prof.competencies.join(", "));
    }
  }

  async function handleLaunch() {
    if (!searchTitles && !searchKeywords) return;
    setLaunching(true);
    const titles = searchTitles.split(",").map((t) => t.trim()).filter(Boolean);
    await supabase.from("search_jobs").insert({
      target_profile_id: selectedProfile || null,
      titles,
      keywords: searchKeywords || null,
      location: searchLocation || null,
      status: "pending",
    });
    setLaunching(false);
    setLaunched(true);
    loadJobs();
    setTimeout(() => setLaunched(false), 4000);
  }

  // Manual
  function buildLinkedInUrl() {
    const parts = [manualTitles, manualKeywords, manualLocation].filter(Boolean);
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(parts.join(" "))}&origin=GLOBAL_SEARCH_HEADER`;
  }

  function handleImportUrlChange(url: string) {
    setImportUrl(url);
    const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
    if (match) {
      const handle = match[1].replace(/-/g, " ");
      const parts = handle.split(" ");
      if (parts.length >= 2) {
        setImportForm((f) => ({
          ...f,
          first_name: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
          last_name: parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" "),
        }));
      }
    }
  }

  async function handleImport() {
    if (!importForm.first_name || !importForm.last_name) return;
    setImporting(true);
    await supabase.from("candidates").insert({
      first_name: importForm.first_name,
      last_name: importForm.last_name,
      title: importForm.title || null,
      company: importForm.company || null,
      linkedin_url: importUrl || null,
      email: importForm.email || null,
      location: importForm.location || null,
      status: "identified",
    });
    setImporting(false);
    setImportSuccess(true);
    setTimeout(() => {
      setImportSuccess(false);
      setShowImport(false);
      setImportUrl("");
      setImportForm({ first_name: "", last_name: "", title: "", company: "", location: "", email: "" });
    }, 1500);
  }

  const statusIcon = (status: string) => {
    if (status === "pending") return <Clock className="w-4 h-4 text-amber-500" />;
    if (status === "running") return <Zap className="w-4 h-4 text-blue-500 animate-pulse" />;
    return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  };

  const statusLabel = (status: string) => {
    if (status === "pending") return "En attente";
    if (status === "running") return "En cours...";
    return "Terminé";
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sourcing candidats</h1>
        <p className="text-slate-500 mt-1">Recherche automatique ou manuelle via LinkedIn</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("auto")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "auto" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Zap className="w-4 h-4" /> Recherche automatique
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "manual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Linkedin className="w-4 h-4" /> Import manuel
        </button>
      </div>

      {tab === "auto" ? (
        <div className="space-y-6">
          {/* Formulaire recherche auto */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold text-slate-900">Configurer la recherche</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Profil cible</label>
                <select className="input" value={selectedProfile} onChange={(e) => handleProfileSelect(e.target.value)}>
                  <option value="">Sélectionner un profil...</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Localisation</label>
                <input className="input" placeholder="France, Paris..." value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} />
              </div>
              <div>
                <label className="label">Titres de poste (séparés par des virgules)</label>
                <input className="input" placeholder="Cloud Architect, AWS Solutions Architect" value={searchTitles} onChange={(e) => setSearchTitles(e.target.value)} />
              </div>
              <div>
                <label className="label">Mots-clés / Compétences</label>
                <input className="input" placeholder="AWS, Terraform, Kubernetes" value={searchKeywords} onChange={(e) => setSearchKeywords(e.target.value)} />
              </div>
            </div>

            <button
              onClick={handleLaunch}
              disabled={launching || (!searchTitles && !searchKeywords)}
              className={`btn-primary flex items-center gap-2 ${launched ? "!bg-emerald-600" : ""}`}
            >
              <Zap className="w-4 h-4" />
              {launched ? "✓ Recherche planifiée !" : launching ? "Planification..." : "Lancer avec Claude"}
            </button>

            {launched && (
              <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800">
                <p className="font-medium mb-1">Recherche en attente</p>
                <p>Écrivez dans le chat : <strong>"Lance la recherche LinkedIn"</strong> pour que Claude extrait les profils automatiquement.</p>
              </div>
            )}
          </div>

          {/* Historique des recherches */}
          {jobs.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Historique des recherches</h2>
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    {statusIcon(job.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {job.titles.join(", ")}
                        {job.keywords ? ` · ${job.keywords}` : ""}
                      </div>
                      <div className="text-xs text-slate-400">
                        {job.location} · {new Date(job.created_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {job.results_count > 0 && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Users className="w-3 h-3" /> {job.results_count} ajoutés
                        </span>
                      )}
                      {jobResult?.jobId === job.id && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          +{jobResult.added} candidats
                        </span>
                      )}
                      <span className={`text-xs font-medium ${job.status === "done" ? "text-emerald-600" : job.status === "running" ? "text-blue-600" : "text-amber-600"}`}>
                        {runningJobId === job.id ? "En cours..." : statusLabel(job.status)}
                      </span>
                      {job.status !== "done" && (
                        <button
                          onClick={() => runJob(job.id)}
                          disabled={!!runningJobId}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          {runningJobId === job.id ? "..." : "Exécuter"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tab manuel */
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Linkedin className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">Recherche LinkedIn</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Titres de poste</label>
                <input className="input" placeholder="Cloud Architect" value={manualTitles} onChange={(e) => setManualTitles(e.target.value)} />
              </div>
              <div>
                <label className="label">Localisation</label>
                <input className="input" placeholder="France" value={manualLocation} onChange={(e) => setManualLocation(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Mots-clés</label>
                <input className="input" placeholder="AWS, Terraform" value={manualKeywords} onChange={(e) => setManualKeywords(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => window.open(buildLinkedInUrl(), "_blank")} disabled={!manualTitles && !manualKeywords} className="btn-primary flex items-center gap-2">
                <Search className="w-4 h-4" /> Ouvrir LinkedIn
              </button>
              <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Importer un profil
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Ouvre LinkedIn avec les critères, puis importe les profils un par un.
            </p>
          </div>

          {showImport && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">Importer un profil LinkedIn</h2>
                  <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-3">
                  <div>
                    <label className="label">URL du profil LinkedIn</label>
                    <input className="input" placeholder="https://linkedin.com/in/prenom-nom" value={importUrl} onChange={(e) => handleImportUrlChange(e.target.value)} />
                    <p className="text-xs text-slate-400 mt-1">Prénom et nom extraits automatiquement</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Prénom *</label><input className="input" value={importForm.first_name} onChange={(e) => setImportForm({ ...importForm, first_name: e.target.value })} /></div>
                    <div><label className="label">Nom *</label><input className="input" value={importForm.last_name} onChange={(e) => setImportForm({ ...importForm, last_name: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Titre</label><input className="input" placeholder="Cloud Architect" value={importForm.title} onChange={(e) => setImportForm({ ...importForm, title: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Entreprise</label><input className="input" value={importForm.company} onChange={(e) => setImportForm({ ...importForm, company: e.target.value })} /></div>
                    <div><label className="label">Localisation</label><input className="input" placeholder="Paris" value={importForm.location} onChange={(e) => setImportForm({ ...importForm, location: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Email</label><input className="input" type="email" value={importForm.email} onChange={(e) => setImportForm({ ...importForm, email: e.target.value })} /></div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                  <button onClick={() => setShowImport(false)} className="btn-secondary">Annuler</button>
                  <button onClick={handleImport} disabled={importing || !importForm.first_name || !importForm.last_name}
                    className={`btn-primary flex items-center gap-2 ${importSuccess ? "!bg-emerald-600" : ""}`}>
                    {importSuccess ? "✓ Ajouté !" : importing ? "Ajout..." : <><UserPlus className="w-4 h-4" /> Ajouter</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card p-8 text-center text-slate-400">
            <ExternalLink className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="text-sm">① Ouvre LinkedIn → ② Parcours les profils → ③ Importe les intéressants</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SourcingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Chargement...</div>}>
      <SourcingContent />
    </Suspense>
  );
}
