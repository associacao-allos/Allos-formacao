"use client";

import { useState } from "react";
import { Search, Bell, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

export default function TopBar() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/formacao?busca=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  }

  return (
    <div
      className="sticky top-0 z-[80] h-[56px] flex items-center justify-end gap-3 px-5 sm:px-6"
      style={{
        background: "rgba(17,17,17,0.8)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Search */}
      <AnimatePresence>
        {searchOpen ? (
          <motion.form
            initial={{ width: 40, opacity: 0.5 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 40, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSearch}
            className="flex items-center gap-2 rounded-xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Search className="h-4 w-4 text-cream/40 ml-3 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cursos..."
              autoFocus
              className="flex-1 bg-transparent text-sm text-cream placeholder:text-cream/25 py-2 pr-2 outline-none font-dm"
            />
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="p-2 text-cream/30 hover:text-cream/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-cream/40 hover:text-cream/70 hover:bg-white/[0.04] transition-all"
            aria-label="Buscar"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
        )}
      </AnimatePresence>

      {/* Notifications placeholder */}
      <button
        className="w-9 h-9 rounded-xl flex items-center justify-center text-cream/40 hover:text-cream/70 hover:bg-white/[0.04] transition-all relative"
        aria-label="Notificações"
      >
        <Bell className="h-[18px] w-[18px]" />
      </button>

      {/* User avatar (quick access) */}
      {user && profile && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
          style={{ background: "rgba(200,75,49,0.15)" }}
        >
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <span className="font-dm text-xs font-bold text-accent">
              {profile.full_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
