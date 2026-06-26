"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Candidate, STATUS_LABELS, STATUS_COLORS, CandidateStatus } from "@/lib/types";
import { Users, Target, Search, TrendingUp, ArrowRight } from "lucide-react";

const PIPELINE_STATUSES: CandidateStatus[] = [
  "identified",
  "contacted",
  "interview_scheduled",
  "selected",
];

export default function Dashboard() {
  const [stats, setStats] = useState({
    targets: 0,
    total: 0,
    contacted: 0,
    selected: 0,
  });
  const [recentCandidates, setRecentCandidates] = useState<Candidate[]>([]);
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ count: targets }, { data: candidates }] = await Promise.all([
        supabase.from("target_profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("candidates")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      const all = candidates || [];
      const counts: Record<string, number> = {};
      all.forEach((c) => {
        counts[c.status] = (counts[c.status] || 0) + 1;
      });

      setStats({
        targets: targets || 0,
        total: all.length,
        contacted: (counts["contacted"] || 0) + (counts["interview_scheduled"] || 0),
        selected: counts["selected"] || 0,
      });
      setPipelineCounts(counts);
      setRecentCandidates(all.slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  const statCards = [
    { label: "Profils cibles", value: stats.targets, icon: Target, color: "text-purple-600 bg-purple-50", href: "/targets" },
    { label: "Candidats sourcés", value: stats.total, icon: Users, color: "text-blue-600 bg-blue-50", href: "/candidates" },
    { label: "En contact", value: stats.contacted, icon: TrendingUp, color: "text-amber-600 bg-amber-50", href: "/candidates" },
    { label: "Sélectionnés", value: stats.selected, icon: Users, color: "text-emerald-600 bg-emerald-50", href: "/candidates" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Vue d&apos;ensemble du recrutement</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, href }) => (
          <Link href={href} key={label} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{loading ? "—" : value}</div>
            <div className="text-sm text-slate-500 mt-1">{label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Pipeline */}
        <div className="col-span-2 card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Pipeline de recrutement</h2>
          <div className="grid grid-cols-4 gap-3">
            {PIPELINE_STATUSES.map((status) => (
              <div key={status} className="text-center">
                <div className="text-2xl font-bold text-slate-900">
                  {loading ? "—" : pipelineCounts[status] || 0}
                </div>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {pipelineCounts["rejected"] || 0} rejeté(s)
            </span>
            <Link href="/candidates" className="text-sm text-primary-600 font-medium flex items-center gap-1 hover:gap-2 transition-all">
              Voir tous les candidats <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Actions rapides</h2>
          <div className="space-y-2">
            <Link href="/targets" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group">
              <Target className="w-5 h-5 text-purple-500" />
              <div>
                <div className="text-sm font-medium text-slate-800">Nouveau profil cible</div>
                <div className="text-xs text-slate-400">Définir un besoin</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-slate-500" />
            </Link>
            <Link href="/sourcing" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group">
              <Search className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-sm font-medium text-slate-800">Rechercher des candidats</div>
                <div className="text-xs text-slate-400">Via Apollo.io</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-slate-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent candidates */}
      {recentCandidates.length > 0 && (
        <div className="card mt-6">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Candidats récents</h2>
            <Link href="/candidates" className="text-sm text-primary-600 hover:underline">Voir tous</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentCandidates.map((c) => (
              <Link
                key={c.id}
                href={`/candidates/${c.id}`}
                className="flex items-center px-6 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold mr-3">
                  {c.first_name[0]}{c.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{c.first_name} {c.last_name}</div>
                  <div className="text-xs text-slate-500 truncate">{c.title} {c.company ? `· ${c.company}` : ""}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
