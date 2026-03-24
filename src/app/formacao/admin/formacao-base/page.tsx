"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";
import { Shield, BookOpen, Calendar, Users, Layers, GraduationCap } from "lucide-react";

// Lazy-load existing page content
const CursosPage = dynamic(() => import("@/app/formacao/admin/cursos/page"), { ssr: false });
const CalendarioPage = dynamic(() => import("@/app/formacao/admin/calendario/page"), { ssr: false });
const CondutoresPage = dynamic(() => import("@/app/formacao/admin/condutores/page"), { ssr: false });
const AtividadesPage = dynamic(() => import("@/app/formacao/admin/atividades/page"), { ssr: false });
const AlunosPage = dynamic(() => import("@/app/formacao/admin/alunos/page"), { ssr: false });

type SubTab = "cursos" | "calendario" | "condutores" | "atividades" | "alunos";

const TABS: { key: SubTab; label: string; icon: typeof Calendar }[] = [
  { key: "cursos", label: "Cursos", icon: BookOpen },
  { key: "alunos", label: "Alunos", icon: GraduationCap },
  { key: "calendario", label: "Calendário", icon: Calendar },
  { key: "condutores", label: "Condutores", icon: Users },
  { key: "atividades", label: "Atividades", icon: Layers },
];

const PAGE_MAP: Record<SubTab, React.ComponentType> = {
  cursos: CursosPage,
  alunos: AlunosPage,
  calendario: CalendarioPage,
  condutores: CondutoresPage,
  atividades: AtividadesPage,
};

export default function FormacaoBasePage() {
  const { isAdmin, isInstructor } = useAuth();
  const [activeTab, setActiveTab] = useState<SubTab>("cursos");

  if (!isAdmin && !isInstructor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-[#C84B31] opacity-60" />
        <p className="font-dm text-sm text-[#FDFBF7]/50">
          Acesso restrito. Apenas administradores e instrutores podem aceder a esta página.
        </p>
      </div>
    );
  }

  const ActivePage = PAGE_MAP[activeTab];

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="font-dm text-xs px-4 py-2 rounded-full flex items-center gap-1.5 transition-all"
              style={{
                backgroundColor: active ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
                color: active ? "#C84B31" : "rgba(253,251,247,0.4)",
                border: `1px solid ${active ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Active page content */}
      <ActivePage />
    </div>
  );
}
