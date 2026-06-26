"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Search,
  UserCheck,
  LayoutDashboard,
  Target,
  ClipboardList,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/targets", label: "Profils cibles", icon: Target },
  { href: "/sourcing", label: "Sourcing", icon: Search },
  { href: "/candidates", label: "Candidats", icon: Users },
  { href: "/interviews", label: "Entretiens", icon: ClipboardList },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="fr">
      <body className="bg-slate-50 min-h-screen">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-60 bg-slate-900 flex flex-col flex-shrink-0">
            <div className="px-6 py-5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-primary-400" />
                <span className="text-white font-bold text-lg">TalentFinder</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">Recrutement intelligent</p>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary-600 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-6 py-4 border-t border-slate-700">
              <p className="text-slate-500 text-xs">Devoteam Cloud</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
