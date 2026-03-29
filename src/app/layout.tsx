import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import "@/styles/globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://allos.org.br"),
  title: "Allos Formação — Plataforma de Cursos",
  description:
    "Plataforma de cursos e formação continuada da Associação Allos. Psicologia, pesquisa e formação de excelência.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${inter.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Detect bfcache restoration and force hard reload
              window.addEventListener('pageshow', function(e) {
                if (e.persisted) { location.reload(); }
              });
              // Detect F5 serving from disk cache (transferSize === 0)
              try {
                var nav = performance.getEntriesByType('navigation')[0];
                if (nav && nav.transferSize === 0 && nav.type === 'reload') {
                  location.replace(location.pathname + '?_r=' + Date.now());
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="font-dm relative z-10 bg-[#111111]">
        <AuthProvider>
        <a href="#main-content" className="skip-link">
          Pular para conteúdo principal
        </a>
        <main id="main-content" className="relative z-10">{children}</main>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              fontFamily: "var(--font-dm)",
              borderRadius: "10px",
              background: "rgba(30,30,30,0.95)",
              border: "1px solid rgba(200,75,49,0.15)",
              color: "#FDFBF7",
              backdropFilter: "blur(12px)",
            },
          }}
        />
        </AuthProvider>
      </body>
    </html>
  );
}
