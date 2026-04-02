"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  BookOpen,
  Trophy,
  Award,
  User,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "allos-sidebar-collapsed";

const mainNav = [
  { label: "Conteúdos", href: "/formacao", icon: Home },
  { label: "Meus cursos", href: "/formacao/meus-cursos", icon: BookOpen, auth: true },
  { label: "Ranking", href: "/formacao#ranking", icon: Trophy },
  { label: "Certificado", href: "https://allos.org.br/certificado", icon: Award, external: true },
];

const externalNav = [
  { label: "Sobre", href: "https://allos.org.br/sobre" },
  { label: "Clínica", href: "https://allos.org.br/clinica" },
  { label: "Projetos", href: "https://allos.org.br/projetos" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, profile, isAdmin, isInstructor, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setCollapsed(saved !== "false");
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  const isActive = (href: string) => {
    if (href === "/formacao") return pathname === "/formacao";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="hidden md:flex fixed top-0 left-0 h-screen z-[90] flex-col"
        style={{
          background: "rgba(17,17,17,0.95)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo */}
        <Link
          href="/formacao"
          className="flex items-center gap-2.5 h-[64px] px-5 flex-shrink-0"
        >
          <Image
            src="/Icone_Allos_Verde.png"
            alt="Allos"
            width={28}
            height={28}
            className="flex-shrink-0"
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="font-fraunces font-bold text-[15px] text-cream tracking-wide">
                  Allos
                </span>
                <span className="block font-dm text-[8px] tracking-[.28em] text-accent uppercase -mt-0.5">
                  Cursos
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {mainNav.map((item) => {
            if (item.auth && !user) return null;
            const active = isActive(item.href);
            const Icon = item.icon;
            const linkProps = item.external
              ? { target: "_blank" as const, rel: "noopener noreferrer" }
              : {};

            return (
              <Link
                key={item.label}
                href={item.href}
                {...linkProps}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 relative ${
                  active
                    ? "text-white"
                    : "text-cream/50 hover:text-cream hover:bg-white/[0.04]"
                }`}
                style={
                  active
                    ? {
                        background: "rgba(200,75,49,0.12)",
                        boxShadow: "0 0 0 1px rgba(200,75,49,0.2)",
                      }
                    : {}
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`h-[18px] w-[18px] flex-shrink-0 ${
                    active ? "text-accent" : ""
                  }`}
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="font-dm text-sm font-medium overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {!collapsed && item.external && (
                  <ExternalLink className="h-3 w-3 text-cream/20 ml-auto" />
                )}
              </Link>
            );
          })}

          {/* Admin link */}
          {(isAdmin || isInstructor) && (
            <Link
              href="/formacao/admin"
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                pathname.startsWith("/formacao/admin")
                  ? "text-white"
                  : "text-cream/50 hover:text-cream hover:bg-white/[0.04]"
              }`}
              style={
                pathname.startsWith("/formacao/admin")
                  ? {
                      background: "rgba(200,75,49,0.12)",
                      boxShadow: "0 0 0 1px rgba(200,75,49,0.2)",
                    }
                  : {}
              }
              title={collapsed ? "Painel" : undefined}
            >
              <LayoutDashboard className="h-[18px] w-[18px] flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-dm text-sm font-medium overflow-hidden whitespace-nowrap"
                  >
                    Painel
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )}

          {/* External links separator */}
          {!collapsed && (
            <div className="pt-4 mt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="px-3 font-dm text-[10px] font-semibold tracking-wider uppercase text-cream/20">
                Allos
              </span>
              <div className="mt-2 space-y-0.5">
                {externalNav.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-cream/35 hover:text-cream/60 transition-colors"
                  >
                    <span className="font-dm text-xs">{item.label}</span>
                    <ExternalLink className="h-2.5 w-2.5 ml-auto opacity-50" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User section + collapse toggle */}
        <div
          className="flex-shrink-0 px-3 py-4 space-y-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {user && profile && (
            <div
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(200,75,49,0.15)" }}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-accent" />
                )}
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 min-w-0 overflow-hidden"
                  >
                    <p className="font-dm text-sm font-medium text-cream truncate">
                      {profile.full_name.split(" ")[0]}
                    </p>
                    <button
                      onClick={signOut}
                      className="font-dm text-[11px] text-cream/30 hover:text-accent transition-colors"
                    >
                      Sair
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {!user && (
            <Link
              href="/formacao/auth"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-cream/50 hover:text-cream transition-colors ${
                collapsed ? "justify-center" : ""
              }`}
              title={collapsed ? "Entrar" : undefined}
            >
              <User className="h-[18px] w-[18px] flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-dm text-sm font-medium overflow-hidden whitespace-nowrap"
                  >
                    Entrar
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )}

          <button
            onClick={toggle}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 w-full text-cream/30 hover:text-cream/60 hover:bg-white/[0.04] transition-all"
            title={collapsed ? "Expandir menu" : "Minimizar menu"}
          >
            {collapsed ? (
              <ChevronRight className="h-[18px] w-[18px] flex-shrink-0 mx-auto" />
            ) : (
              <>
                <ChevronLeft className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="font-dm text-xs">Minimizar</span>
              </>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[90] flex items-center justify-around py-2 px-2 safe-area-pb"
        style={{
          background: "rgba(17,17,17,0.95)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        {mainNav.filter((i) => !(i.auth && !user)).map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors ${
                active ? "text-accent" : "text-cream/40"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-dm text-[10px]">{item.label}</span>
            </Link>
          );
        })}
        {user ? (
          <Link
            href="/formacao/meus-cursos"
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-cream/40"
          >
            <User className="h-5 w-5" />
            <span className="font-dm text-[10px]">Perfil</span>
          </Link>
        ) : (
          <Link
            href="/formacao/auth"
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-cream/40"
          >
            <User className="h-5 w-5" />
            <span className="font-dm text-[10px]">Entrar</span>
          </Link>
        )}
      </nav>
    </>
  );
}

// Hook to get current sidebar width for layout offset
export function useSidebarWidth() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setCollapsed(saved !== "false");

    // Listen for storage changes (same tab)
    const interval = setInterval(() => {
      const val = localStorage.getItem(STORAGE_KEY);
      setCollapsed(val !== "false");
    }, 200);

    return () => {
      window.removeEventListener("resize", checkMobile);
      clearInterval(interval);
    };
  }, []);

  if (isMobile) return 0;
  return collapsed ? 72 : 240;
}
