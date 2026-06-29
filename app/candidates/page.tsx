"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Candidate, STATUS_LABELS, STATUS_COLORS, CandidateStatus } from "@/lib/types";
import { Plus, Users, ExternalLink, X, Search, LayoutGrid, List, MoreHorizontal, Archive, ArchiveRestore, Trash2 } from "lucide-react";

interface TargetProfileLight { id: string; name: string; }

const PIPELINE: CandidateStatus[] = ["identified", "contacted", "interview_scheduled", "selected", "rejected"];

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [targetProfiles, setTargetProfiles] = useState<TargetProfileLight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  // Filtres
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<CandidateStatus | "">("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterProfile, setFilterProfile] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "", last_name: "", title: "", company: "",
    linkedin_url: "", email: "", location: "",
  });

  async function load() {
    const [{ data, error }, { data: profs }] = await Promise.all([
      supabase.from("candidates").select("*").order("created_at", { ascending: false }),
      supabase.from("target_profiles").select("id, name").order("name"),
    ]);
    if (error) console.error("[load] Erreur SELECT:", error);
    setCandidates(data || []);
    setTargetProfiles(profs || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleArchive(c: Candidate) {
    await supabase.from("candidates").update({ archived: !c.archived }).eq("id", c.id);
    setOpenMenuId(null);
    load();
  }

  async function deleteCandidate(c: Candidate) {
    if (!confirm(`Supprimer définitivement ${c.first_name} ${c.last_name} ? Cette action est irréversible.`)) return;
    await supabase.from("candidates").delete().eq("id", c.id);
    setOpenMenuId(null);
    load();
  }

  async function handleSave() {
    if (!form.first_name || !form.last_name) return;
    setSaving(true);
    const { error } = await supabase.from("candidates").insert({
      ...form,
      status: "identified",
      linkedin_url: form.linkedin_url || null,
      email: form.email || null,
      location: form.location || null,
    }).select();
    setSaving(false);
    if (error) { alert(`Erreur : ${error.message}`); return; }
    setForm({ first_name: "", last_name: "", title: "", company: "", linkedin_url: "", email: "", location: "" });
    setShowForm(false);
    load();
  }

  // Titres uniques pour le filtre
  const uniqueTitles = useMemo(() =>
    [...new Set(candidates.map((c) => c.title).filter(Boolean) as string[])].sort(),
    [candidates]
  );

  // Candidats filtrés
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return candidates.filter((c) => {
      const matchSearch = !q || [c.first_name, c.last_name, c.title, c.company, c.location]
        .some((f) => f?.toLowerCase().includes(q));
      const matchStatus = !filterStatus || c.status === filterStatus;
      const matchTitle = !filterTitle || c.title === filterTitle;
      const matchProfile = !filterProfile || c.target_profile_id === filterProfile;
      const matchArchived = showArchived ? c.archived : !c.archived;
      return matchSearch && matchStatus && matchTitle && matchProfile && matchArchived;
    });
  }, [candidates, search, filterStatus, filterTitle, filterProfile, showArchived]);

  const byStatus = (status: CandidateStatus) => filtered.filter((c) => c.status === status);

  const hasFilters = search || filterStatus || filterTitle || filterProfile || showArchived;
  const archivedCount = candidates.filter((c) => c.archived).length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Candidats</h1>
          <p className="text-slate-500 mt-1">{filtered.length} / {candidates.length} candidat(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter manuellement
        </button>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par nom, poste, entreprise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-44" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as CandidateStatus | "")}>
          <option value="">Tous les statuts</option>
          {PIPELINE.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select className="input w-48" value={filterProfile} onChange={(e) => setFilterProfile(e.target.value)}>
          <option value="">Tous les profils</option>
          {targetProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input w-48" value={filterTitle} onChange={(e) => setFilterTitle(e.target.value)}>
          <option value="">Tous les rôles</option>
          {uniqueTitles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${showArchived ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
        >
          <Archive className="w-3.5 h-3.5" />
          Archivés {archivedCount > 0 && <span className="bg-amber-200 text-amber-800 rounded-full px-1.5 py-0.5">{archivedCount}</span>}
        </button>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterTitle(""); setShowArchived(false); }}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <X className="w-3 h-3" /> Réinitialiser
          </button>
        )}
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setView("kanban")} className={`p-2 rounded-lg ${view === "kanban" ? "bg-primary-50 text-primary-700" : "text-slate-400 hover:text-slate-600"}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView("list")} className={`p-2 rounded-lg ${view === "list" ? "bg-primary-50 text-primary-700" : "text-slate-400 hover:text-slate-600"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal ajout */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Ajouter un candidat</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Prénom *</label><input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                <div><label className="label">Nom *</label><input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              </div>
              <div><label className="label">Titre</label><input className="input" placeholder="Cloud Architect" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="label">Entreprise</label><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div><label className="label">URL LinkedIn</label><input className="input" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><label className="label">Localisation</label><input className="input" placeholder="Paris" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name} className="btn-primary">
                {saving ? "Enregistrement..." : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Chargement...</div>
      ) : candidates.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun candidat</p>
          <p className="text-slate-400 text-sm mt-1">Utilisez le sourcing ou ajoutez manuellement</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun résultat</p>
          <p className="text-slate-400 text-sm mt-1">Modifiez les filtres</p>
        </div>
      ) : view === "kanban" ? (
        /* Vue Kanban */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE.map((status) => {
            const cols = byStatus(status);
            return (
              <div key={status} className="flex-shrink-0 w-64">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{cols.length}</span>
                </div>
                <div className="space-y-2">
                  {cols.map((c) => (
                    <div key={c.id} className="card p-3 hover:shadow-md transition-shadow relative group">
                      <Link href={`/candidates/${c.id}`} className="block">
                        <div className="flex items-center gap-2 mb-2">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt={`${c.first_name} ${c.last_name}`} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                              {c.first_name[0]}{c.last_name[0]}
                            </div>
                          )}
                          <div className="text-sm font-medium text-slate-900 truncate">{c.first_name} {c.last_name}</div>
                        </div>
                        <div className="text-xs text-slate-500 truncate">{c.title}</div>
                        <div className="text-xs text-slate-400 truncate">{c.company}</div>
                        {c.linkedin_url && <div className="mt-2 flex items-center gap-1 text-xs text-blue-500"><ExternalLink className="w-3 h-3" /> LinkedIn</div>}
                      </Link>
                      {/* Menu options */}
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={(e) => { e.preventDefault(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}
                          className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openMenuId === c.id && (
                          <div className="absolute right-0 top-6 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-36 py-1">
                            <button
                              onClick={() => toggleArchive(c)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {c.archived ? <><ArchiveRestore className="w-3.5 h-3.5 text-emerald-500" /> Désarchiver</> : <><Archive className="w-3.5 h-3.5 text-amber-500" /> Archiver</>}
                            </button>
                            <button
                              onClick={() => deleteCandidate(c)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {cols.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-xs text-slate-400">Aucun candidat</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vue Liste */
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Candidat</th>
                <th className="text-left px-4 py-3 font-medium">Rôle</th>
                <th className="text-left px-4 py-3 font-medium">Entreprise</th>
                <th className="text-left px-4 py-3 font-medium">Localisation</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt={`${c.first_name} ${c.last_name}`} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                      <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      )}
                      <Link href={`/candidates/${c.id}`} className="font-medium text-slate-900 hover:text-primary-700">
                        {c.first_name} {c.last_name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.title || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.company || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{c.location || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openMenuId === c.id && (
                          <div className="absolute right-0 top-6 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-36 py-1">
                            <button
                              onClick={() => toggleArchive(c)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {c.archived ? <><ArchiveRestore className="w-3.5 h-3.5 text-emerald-500" /> Désarchiver</> : <><Archive className="w-3.5 h-3.5 text-amber-500" /> Archiver</>}
                            </button>
                            <button
                              onClick={() => deleteCandidate(c)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
