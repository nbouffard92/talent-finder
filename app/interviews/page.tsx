"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Interview, TargetProfile } from "@/lib/types";
import { Star, ExternalLink, ChevronDown } from "lucide-react";

const RECOMMENDATION_CONFIG = {
  go: { label: "Go", color: "bg-emerald-100 text-emerald-700" },
  maybe: { label: "À revoir", color: "bg-amber-100 text-amber-700" },
  no_go: { label: "No Go", color: "bg-red-100 text-red-700" },
};

function StarDisplay({ value, max = 5 }: { value: number; max?: number }) {
  if (!value) return <span className="text-slate-300 text-sm">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < value ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1">{value}/5</span>
    </div>
  );
}

interface InterviewRow extends Interview {
  candidate_name: string;
  candidate_title: string;
  candidate_company: string;
  candidate_linkedin: string;
  candidate_id: string;
  target_profile_name: string;
  target_profile_id: string;
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [profiles, setProfiles] = useState<TargetProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: ivData }, { data: profileData }] = await Promise.all([
        supabase
          .from("interviews")
          .select(`
            *,
            candidate:candidates(
              id, first_name, last_name, title, company, linkedin_url,
              target_profile:target_profiles(id, name)
            )
          `)
          .order("interview_date", { ascending: false, nullsFirst: false }),
        supabase.from("target_profiles").select("*").order("name"),
      ]);

      setProfiles(profileData || []);

      const rows: InterviewRow[] = (ivData || []).map((iv: any) => ({
        ...iv,
        candidate_id: iv.candidate?.id || "",
        candidate_name: `${iv.candidate?.first_name || ""} ${iv.candidate?.last_name || ""}`.trim(),
        candidate_title: iv.candidate?.title || "",
        candidate_company: iv.candidate?.company || "",
        candidate_linkedin: iv.candidate?.linkedin_url || "",
        target_profile_name: iv.candidate?.target_profile?.name || "—",
        target_profile_id: iv.candidate?.target_profile?.id || "",
      }));

      setInterviews(rows);
      setLoading(false);
    }
    load();
  }, []);

  const filtered =
    selectedProfile === "all"
      ? interviews
      : interviews.filter((iv) => iv.target_profile_id === selectedProfile);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Entretiens</h1>
          <p className="text-slate-500 mt-1">
            {loading ? "Chargement..." : `${filtered.length} entretien${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Filtre profil cible */}
        <div className="relative">
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="appearance-none pl-4 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
          >
            <option value="all">Tous les profils cibles</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Candidat</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Profil cible</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Note globale</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fit culturel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Prétention</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Points forts</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Recommandation</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    Chargement...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    Aucun entretien trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((iv) => (
                  <tr key={iv.id} className="hover:bg-slate-50 transition-colors group">
                    {/* Candidat */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {iv.candidate_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{iv.candidate_name}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {iv.candidate_title}
                            {iv.candidate_company ? ` · ${iv.candidate_company}` : ""}
                          </div>
                        </div>
                        {iv.candidate_linkedin && (
                          <a
                            href={iv.candidate_linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-400 hover:text-blue-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Profil cible */}
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                        {iv.target_profile_name}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                      {iv.interview_date
                        ? new Date(iv.interview_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                        : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Note globale */}
                    <td className="px-4 py-4">
                      <StarDisplay value={iv.overall_rating || 0} />
                    </td>

                    {/* Fit culturel */}
                    <td className="px-4 py-4">
                      <StarDisplay value={iv.cultural_fit || 0} />
                    </td>

                    {/* Prétention salariale */}
                    <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                      {iv.salary_expectation
                        ? `${iv.salary_expectation} k€`
                        : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Points forts */}
                    <td className="px-4 py-4 max-w-xs">
                      {iv.strengths ? (
                        <p className="text-slate-600 text-xs leading-relaxed line-clamp-2">{iv.strengths}</p>
                      ) : iv.ai_summary ? (
                        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 italic">{iv.ai_summary}</p>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Recommandation */}
                    <td className="px-4 py-4">
                      {iv.recommendation ? (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${RECOMMENDATION_CONFIG[iv.recommendation].color}`}>
                          {RECOMMENDATION_CONFIG[iv.recommendation].label}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Lien */}
                    <td className="px-4 py-4">
                      <Link
                        href={`/interview/${iv.id}`}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                      >
                        Voir →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
