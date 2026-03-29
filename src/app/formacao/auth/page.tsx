"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import GoogleButton from "@/components/auth/GoogleButton";
import { BookOpen } from "lucide-react";

function AuthContent() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || undefined;
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTo || "/formacao");
    }
  }, [user, loading, router, redirectTo]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#111111" }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div
              className="w-11 h-11 rounded-[12px] flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #C84B31, #A33D27)",
                boxShadow: "0 4px 20px rgba(200,75,49,0.3)",
              }}
            >
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="font-fraunces font-bold text-2xl text-cream tracking-tight">
              Allos <span className="italic text-accent">Formação</span>
            </span>
          </div>
          <p className="text-cream/40 text-sm font-dm">
            Acesse sua conta para continuar aprendendo.
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-[16px] p-8"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Tab toggle */}
          <div
            className="flex rounded-[10px] p-1 mb-6"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <button
              onClick={() => setTab("login")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-[8px] transition-all duration-200 ${
                tab === "login"
                  ? "text-white shadow-md"
                  : "text-cream/40 hover:text-cream/60"
              }`}
              style={
                tab === "login"
                  ? {
                      background: "linear-gradient(135deg, #C84B31, #A33D27)",
                      boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
                    }
                  : {}
              }
            >
              Entrar
            </button>
            <button
              onClick={() => setTab("register")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-[8px] transition-all duration-200 ${
                tab === "register"
                  ? "text-white shadow-md"
                  : "text-cream/40 hover:text-cream/60"
              }`}
              style={
                tab === "register"
                  ? {
                      background: "linear-gradient(135deg, #C84B31, #A33D27)",
                      boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
                    }
                  : {}
              }
            >
              Criar conta
            </button>
          </div>

          {/* Google */}
          <GoogleButton redirectTo={redirectTo} />

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 divider-gradient" />
            <span className="text-xs text-cream/30 font-dm">ou</span>
            <div className="flex-1 divider-gradient" />
          </div>

          {/* Form */}
          {tab === "login" ? (
            <LoginForm redirectTo={redirectTo} />
          ) : (
            <RegisterForm redirectTo={redirectTo} />
          )}
        </div>

        {/* Footer link */}
        <p className="text-center text-xs text-cream/30 mt-6">
          Ao continuar, você concorda com os{" "}
          <a href="/termos" className="text-accent hover:underline">
            termos de uso
          </a>{" "}
          da Associação Allos.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#111111" }}>
          <div className="animate-pulse text-cream/30">Carregando...</div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
