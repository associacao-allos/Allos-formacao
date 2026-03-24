"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import Badge from "@/components/ui/Badge";
import { LogOut, User, LayoutDashboard, BookOpen } from "lucide-react";

export default function Header() {
  const { user, profile, loading, signOut, isAdmin, isInstructor } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const siteLinks = [
    { label: "Sobre", href: "https://allos.org.br/sobre" },
    { label: "Clínica", href: "https://allos.org.br/clinica" },
    { label: "Cursos", href: "/formacao" },
    { label: "Projetos", href: "https://allos.org.br/projetos" },
  ];

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-500"
        style={{
          background: scrolled ? "rgba(17,17,17,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(200,75,49,0.08)" : "1px solid transparent",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-[68px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/formacao" className="flex items-center gap-2.5">
            <Image src="/Icone_Allos_Verde.png" alt="Allos" width={32} height={32} />
            <div>
              <span className="font-fraunces font-bold text-[17px] text-[#FDFBF7] tracking-wide">Allos</span>
              <span className="block font-dm text-[9px] tracking-[.28em] text-[#C84B31] uppercase -mt-0.5">Cursos</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {siteLinks.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className={`font-dm text-sm transition-colors duration-200 ${
                  l.href === "/formacao"
                    ? "text-[#C84B31] font-medium"
                    : "text-[rgba(253,251,247,0.5)] hover:text-[#FDFBF7]"
                }`}
                {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            {!loading && user && profile ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/formacao/meus-cursos"
                  className="flex items-center gap-1.5 text-sm text-[rgba(253,251,247,0.5)] hover:text-[#C84B31] transition-colors duration-200"
                >
                  <BookOpen className="h-4 w-4" />
                  Meus cursos
                </Link>
                {(isAdmin || isInstructor) && (
                  <Link
                    href="/formacao/admin"
                    className="flex items-center gap-1.5 text-sm text-[rgba(253,251,247,0.5)] hover:text-[#C84B31] transition-colors duration-200"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Painel
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
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
                  <span className="text-sm font-medium text-cream">
                    {profile.full_name.split(" ")[0]}
                  </span>
                  {isInstructor && <Badge variant="instructor">Professor</Badge>}
                  {isAdmin && <Badge variant="admin">Admin</Badge>}
                </div>
                <button
                  onClick={signOut}
                  className="p-2 text-cream/40 hover:text-accent transition-colors"
                  aria-label="Sair"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : !loading ? (
              <Link
                href="/formacao/auth"
                className="font-dm text-sm font-semibold text-white bg-[#C84B31] px-5 py-2 rounded-full hover:bg-[#A33D27] transition-colors"
                style={{ boxShadow: "0 4px 20px rgba(200,75,49,0.25)" }}
              >
                Entrar
              </Link>
            ) : null}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setOpen(!open)} className="md:hidden flex flex-col gap-[5px] p-2" aria-label="Menu">
            <span className={`block w-6 h-[1.5px] bg-[#FDFBF7] transition-all duration-300 ${open ? "rotate-45 translate-y-[6.5px]" : ""}`} />
            <span className={`block w-6 h-[1.5px] bg-[#FDFBF7] transition-all duration-300 ${open ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-[1.5px] bg-[#FDFBF7] transition-all duration-300 ${open ? "-rotate-45 -translate-y-[6.5px]" : ""}`} />
          </button>
        </div>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[100] bg-black/40"
            />
            <motion.div
              key="drawer"
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed inset-y-0 right-0 w-[80vw] max-w-[320px] z-[101]"
              style={{ background: "#141414", borderLeft: "1px solid rgba(200,75,49,0.1)" }}
            >
              <div className="flex flex-col gap-6 px-8 py-10 pt-24">
                {siteLinks.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="font-fraunces font-bold text-xl text-[#FDFBF7] hover:text-[#C84B31] transition-colors"
                    {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {l.label}
                  </Link>
                ))}

                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {user && profile ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium text-cream">{profile.full_name}</span>
                      </div>
                      <Link
                        href="/formacao/meus-cursos"
                        className="block text-sm text-cream/70"
                        onClick={() => setOpen(false)}
                      >
                        Meus cursos
                      </Link>
                      {(isAdmin || isInstructor) && (
                        <Link
                          href="/formacao/admin"
                          className="block text-sm text-cream/70"
                          onClick={() => setOpen(false)}
                        >
                          Painel Administrativo
                        </Link>
                      )}
                      <button
                        onClick={() => { signOut(); setOpen(false); }}
                        className="text-sm text-accent"
                      >
                        Sair da conta
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/formacao/auth"
                      onClick={() => setOpen(false)}
                      className="block w-full text-center font-dm text-sm font-semibold text-white bg-[#C84B31] px-6 py-3 rounded-full"
                    >
                      Entrar
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
