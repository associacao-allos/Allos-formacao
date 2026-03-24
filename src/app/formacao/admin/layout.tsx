"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import CourseBackground from "@/components/course/CourseBackground";
import { useAuth } from "@/hooks/useAuth";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Award,
  Settings,
  MessageSquare,
  Tag,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  User,
  Video,
  FileText,
  GraduationCap,
  Calendar,
} from "lucide-react";

const navItems = [
  { href: "/formacao/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/formacao/admin/formacao-base", label: "Formação", icon: Calendar },
  { href: "/formacao/admin/certificados", label: "Certificados", icon: Award },
  { href: "/formacao/admin/moderacao", label: "Moderação", icon: MessageSquare },
  { href: "/formacao/admin/configuracoes", label: "Configurações", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/formacao/admin": "Dashboard",
  "/formacao/admin/formacao-base": "Formação",
  "/formacao/admin/certificados": "Certificados",
  "/formacao/admin/moderacao": "Moderação",
  "/formacao/admin/configuracoes": "Configurações",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading, signOut, isAdmin, isInstructor } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin && !isInstructor) {
      router.push("/formacao");
    }
  }, [loading, isAdmin, isInstructor, router]);

  const currentPageTitle =
    Object.entries(pageTitles).find(([path]) =>
      pathname === path || (path !== "/formacao/admin" && pathname.startsWith(path))
    )?.[1] || "Admin";

  if (loading) {
    return (
      <div className="flex h-screen" style={{ background: "#111111" }}>
        <div className="w-64 p-6 space-y-4" style={{ background: "#0D0D0D" }}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-10 w-1/3 mb-8" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Hide parent layout header/footer when admin panel is active
  useEffect(() => {
    const nav = document.querySelector("nav.fixed");
    const footer = document.querySelector("footer");
    const floating = document.querySelector("[data-floating-question]");
    if (nav) (nav as HTMLElement).style.display = "none";
    if (footer) (footer as HTMLElement).style.display = "none";
    if (floating) (floating as HTMLElement).style.display = "none";
    document.body.style.paddingTop = "0";
    return () => {
      if (nav) (nav as HTMLElement).style.display = "";
      if (footer) (footer as HTMLElement).style.display = "";
      if (floating) (floating as HTMLElement).style.display = "";
      document.body.style.paddingTop = "";
    };
  }, []);

  if (!profile || (!isAdmin && !isInstructor)) return null;

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Brand with logo */}
      <div className="p-6" style={{ borderBottom: "1px solid rgba(200,75,49,0.1)" }}>
        <Link href="/formacao/admin" className="flex items-center gap-2.5">
          <Image src="/Icone_Allos_Verde.png" alt="Allos" width={28} height={28} />
          <div>
            <span className="font-fraunces font-bold text-[16px] text-cream tracking-wide">Allos</span>
            <span className="block font-dm text-[8px] tracking-[.28em] text-accent uppercase -mt-0.5">Painel Admin</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/formacao/admin" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-4 py-2.5 rounded-[10px] text-sm
                transition-all duration-200
                ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-cream/50 hover:text-cream hover:bg-white/5"
                }
              `}
              style={
                isActive
                  ? {
                      background: "linear-gradient(135deg, #C84B31, #A33D27)",
                      boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
                    }
                  : {}
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Back to site */}
      <div className="p-4" style={{ borderTop: "1px solid rgba(200,75,49,0.08)" }}>
        <Link
          href="/formacao"
          className="flex items-center gap-2 px-4 py-2 text-sm text-cream/35 hover:text-accent transition-colors duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar ao site
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen relative">
      {/* Starfield + grain + orbs */}
      <CourseBackground />

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block w-64 flex-shrink-0 relative z-10"
        style={{
          background: "rgba(13,13,13,0.75)",
          borderRight: "1px solid rgba(200,75,49,0.06)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-0 left-0 w-64 h-full"
              style={{ background: "#0D0D0D" }}
            >
              <div className="flex justify-end p-4">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-cream/50 hover:text-cream transition-colors"
                  aria-label="Fechar menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Topbar */}
        <header
          className="h-16 flex items-center justify-between px-6 flex-shrink-0"
          style={{
            background: "rgba(17,17,17,0.6)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(200,75,49,0.06)",
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-cream"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Page title */}
            <h2 className="font-dm font-semibold text-cream/70 text-sm hidden sm:block">
              {currentPageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-cream">
                {profile.full_name}
              </p>
              <Badge variant={profile.role}>
                {profile.role === "admin"
                  ? "Admin"
                  : profile.role === "instructor"
                    ? "Professor"
                    : "Aluno"}
              </Badge>
            </div>
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
              style={{ background: "rgba(200,75,49,0.12)", border: "1px solid rgba(200,75,49,0.2)" }}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-accent" />
              )}
            </div>
            <button
              onClick={signOut}
              className="p-2 text-cream/40 hover:text-accent transition-colors"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
