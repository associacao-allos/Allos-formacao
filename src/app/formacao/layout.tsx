import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FloatingQuestionButton from "@/components/ui/FloatingQuestionButton";
import BfcacheReload from "@/components/layout/BfcacheReload";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cursos — Allos Formação",
  description:
    "Explore nossos cursos de psicologia, pesquisa e formação continuada. Cursos gravados, ao vivo e formação síncrona contínua pela Associação Allos.",
  keywords: [
    "psicologia", "cursos", "formação continuada", "terapia",
    "psicoterapia", "Allos", "certificado", "clínica",
  ],
  openGraph: {
    title: "Cursos — Allos Formação",
    description: "Formação clínica crítica e existencial. Cursos de psicologia e áreas correlatas pela Associação Allos.",
    type: "website",
    locale: "pt_BR",
    siteName: "Allos Formação",
    images: [
      {
        url: "/og-formacao.png",
        width: 1200,
        height: 630,
        alt: "Allos Formação — Cursos de psicologia e formação continuada",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cursos — Allos Formação",
    description: "Formação clínica crítica e existencial. Cursos pela Associação Allos.",
    images: ["/og-formacao.png"],
  },
};

export default function FormacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BfcacheReload />
      <Header />
      <div className="min-h-screen">{children}</div>
      <Footer />
      <FloatingQuestionButton />
    </>
  );
}
