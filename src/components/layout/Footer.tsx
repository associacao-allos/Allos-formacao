"use client";
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer style={{ background: "#1A1A1A", color: "#FDFBF7" }}>
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 pt-16 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 mb-14">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <Image src="/Icone_Allos_Verde.png" alt="Allos" width={32} height={32} />
              <div>
                <span className="font-fraunces font-bold text-lg text-[#FDFBF7] tracking-wide">Allos</span>
                <span className="block font-dm text-[9px] tracking-[.28em] text-[#C84B31] uppercase -mt-0.5">Cursos</span>
              </div>
            </div>
            <p className="font-dm text-[rgba(253,251,247,.5)] text-sm leading-relaxed">
              Transformando talentos em legado — Psicologia clínica com excelência.
            </p>
          </div>

          {/* Endereço */}
          <div>
            <h4 className="font-dm font-semibold text-[11px] tracking-[.24em] text-[#C84B31] uppercase mb-5">Endereço</h4>
            <address className="not-italic font-dm text-[rgba(253,251,247,.5)] text-sm leading-loose">
              Rua Rio Negro, 1048<br />Belo Horizonte – MG<br />CEP: 30.431-058
            </address>
          </div>

          {/* Contato */}
          <div>
            <h4 className="font-dm font-semibold text-[11px] tracking-[.24em] text-[#C84B31] uppercase mb-5">Contato</h4>
            <div className="flex flex-col gap-2.5">
              <a href="mailto:suporte@allos.org.br" className="font-dm text-[rgba(253,251,247,.5)] text-sm hover:text-[#C84B31] transition-colors">
                suporte@allos.org.br
              </a>
              <a href="https://wa.me/5531987577892" target="_blank" rel="noreferrer" className="font-dm text-[rgba(253,251,247,.5)] text-sm hover:text-[#C84B31] transition-colors">
                +55 31 98757-7892
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-dm font-semibold text-[11px] tracking-[.24em] text-[#C84B31] uppercase mb-5">Links</h4>
            <nav className="flex flex-col gap-2.5">
              <Link href="/formacao" className="font-dm text-[rgba(253,251,247,.5)] text-sm hover:text-[#FDFBF7] transition-colors">Cursos</Link>
              <Link href="/formacao/auth" className="font-dm text-[rgba(253,251,247,.5)] text-sm hover:text-[#FDFBF7] transition-colors">Criar conta</Link>
              <a href="https://allos.org.br/sobre" target="_blank" rel="noopener noreferrer" className="font-dm text-[rgba(253,251,247,.5)] text-sm hover:text-[#FDFBF7] transition-colors">Sobre a Allos</a>
              <a href="https://allos.org.br/faq" target="_blank" rel="noopener noreferrer" className="font-dm text-[rgba(253,251,247,.5)] text-sm hover:text-[#FDFBF7] transition-colors">FAQ</a>
              <a href="https://allos.org.br/clinica" target="_blank" rel="noopener noreferrer" className="font-dm text-[rgba(253,251,247,.5)] text-sm hover:text-[#FDFBF7] transition-colors">Clínica Social</a>
            </nav>
          </div>
        </div>

        {/* Google review */}
        <a href="https://search.google.com/local/writereview?placeid=ChIJRU1omzaXpgARA4UFQLEIq4g" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl mb-8 transition-all hover:-translate-y-0.5"
          style={{ background: "rgba(251,188,5,0.06)", border: "1px solid rgba(251,188,5,0.18)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="font-dm text-sm font-medium" style={{ color: "rgba(253,251,247,.65)" }}>Avalie-nos no Google</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(253,251,247,.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>

        {/* Social */}
        <div className="flex gap-3 mb-12">
          <a href="https://www.instagram.com/associacaoallos/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[rgba(253,251,247,.45)] hover:text-[#C84B31] transition-all duration-200"
            style={{ border: "1px solid rgba(253,251,247,.12)" }}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
          </a>
          <a href="https://www.youtube.com/@associacaoallos" target="_blank" rel="noopener noreferrer" aria-label="YouTube"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[rgba(253,251,247,.45)] hover:text-[#C84B31] transition-all duration-200"
            style={{ border: "1px solid rgba(253,251,247,.12)" }}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" /></svg>
          </a>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3"
          style={{ borderTop: "1px solid rgba(253,251,247,.08)" }}>
          <p className="font-dm text-[rgba(253,251,247,.3)] text-xs">© {new Date().getFullYear()} Associação Allos. Todos os direitos reservados.</p>
          <p className="font-dm text-[rgba(253,251,247,.3)] text-xs">Belo Horizonte, MG — Brasil</p>
        </div>
      </div>
    </footer>
  );
}
