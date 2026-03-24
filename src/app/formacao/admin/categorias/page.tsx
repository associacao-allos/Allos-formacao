"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { motion } from "framer-motion";
import { Plus, X, Tag, RotateCcw, AlertTriangle, BookOpen, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

interface CategoryRow {
  id: string;
  name: string;
}

export default function CategoriasPage() {
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [usedCategories, setUsedCategories] = useState<Record<string, number>>({});
  const [coursesByCategory, setCoursesByCategory] = useState<Record<string, { id: string; title: string }[]>>({});
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    async function fetch() {
      const client = createClient();

      const [catsRes, coursesRes] = await Promise.all([
        client.from("categories").select("id, name").order("name"),
        client.from("courses").select("id, title, category").not("category", "is", null),
      ]);

      const counts: Record<string, number> = {};
      const byCategory: Record<string, { id: string; title: string }[]> = {};
      coursesRes.data?.forEach((c: { id: string; title: string; category: string }) => {
        if (c.category) {
          counts[c.category] = (counts[c.category] || 0) + 1;
          if (!byCategory[c.category]) byCategory[c.category] = [];
          byCategory[c.category].push({ id: c.id, title: c.title });
        }
      });
      setUsedCategories(counts);
      setCoursesByCategory(byCategory);

      if (catsRes.data) {
        setCategories(catsRes.data);
      }
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, []);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    if (categories.some((c) => c.name === name)) {
      toast.error("Essa categoria já existe.");
      return;
    }

    setAdding(true);
    const client = createClient();
    const { data, error } = await client
      .from("categories")
      .insert({ name })
      .select("id, name")
      .single();

    if (error || !data) {
      toast.error("Erro ao adicionar categoria.");
      setAdding(false);
      return;
    }

    setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setAdding(false);
    toast.success(`Categoria "${name}" adicionada!`);
  }

  async function handleRemove() {
    if (!deleteTarget) return;
    const client = createClient();

    // Remove category from all courses that use it
    const courses = coursesByCategory[deleteTarget.name] || [];
    if (courses.length > 0) {
      await client.from("courses").update({ category: null }).eq("category", deleteTarget.name);
    }

    // Delete the category
    const { error } = await client.from("categories").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Erro ao remover categoria.");
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setUsedCategories((prev) => { const next = { ...prev }; delete next[deleteTarget.name]; return next; });
    setCoursesByCategory((prev) => { const next = { ...prev }; delete next[deleteTarget.name]; return next; });
    setDeleteTarget(null);
    toast.success(`Categoria removida.${courses.length > 0 ? ` ${courses.length} curso(s) desassociado(s).` : ""}`);
  }

  async function handleEdit(cat: CategoryRow) {
    const name = editName.trim();
    if (!name || name === cat.name) { setEditingId(null); return; }
    if (categories.some((c) => c.name === name && c.id !== cat.id)) {
      toast.error("Essa categoria já existe.");
      return;
    }
    const client = createClient();
    // Update category name
    const { error } = await client.from("categories").update({ name }).eq("id", cat.id);
    if (error) { toast.error("Erro ao renomear."); return; }
    // Also update courses that use the old name
    await client.from("courses").update({ category: name }).eq("category", cat.name);
    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, name } : c).sort((a, b) => a.name.localeCompare(b.name)));
    setEditingId(null);
    toast.success(`Categoria renomeada para "${name}"`);
  }

  async function handleReset() {
    const client = createClient();

    // Delete all non-default categories that aren't in use
    const nonDefaults = categories.filter(
      (c) => !DEFAULT_CATEGORIES.includes(c.name) && !usedCategories[c.name]
    );
    for (const cat of nonDefaults) {
      await client.from("categories").delete().eq("id", cat.id);
    }

    // Insert missing defaults
    for (const name of DEFAULT_CATEGORIES) {
      if (!categories.some((c) => c.name === name)) {
        await client.from("categories").insert({ name });
      }
    }

    // Reload
    const { data } = await client.from("categories").select("id, name").order("name");
    if (data) setCategories(data);
    toast.success("Categorias restauradas ao padrão.");
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <Tag className="h-12 w-12 text-cream/20 mx-auto mb-4" />
        <h2 className="font-fraunces font-bold text-xl text-cream mb-2">Acesso restrito</h2>
        <p className="text-cream/40">Apenas administradores podem gerenciar categorias.</p>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
            Categorias
          </h1>
          <p className="text-sm text-cream/35 mt-1">
            Gerencie as categorias disponíveis para os cursos.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          Restaurar padrão
        </Button>
      </motion.div>

      {/* Add new category */}
      <div
        className="flex flex-col sm:flex-row gap-3 mb-8 p-5 rounded-[16px]"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="relative flex-1">
          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Nome da nova categoria..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm"
          />
        </div>
        <Button onClick={handleAdd} disabled={!newName.trim() || adding} loading={adding}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Categories grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-[12px] animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat, i) => {
            const count = usedCategories[cat.name] || 0;
            const isDefault = DEFAULT_CATEGORIES.includes(cat.name);

            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-4 rounded-[12px] group transition-all duration-200 hover:bg-white/[.02]"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isDefault ? "rgba(200,75,49,0.08)" : "rgba(46,158,143,0.08)",
                      border: isDefault ? "1px solid rgba(200,75,49,0.15)" : "1px solid rgba(46,158,143,0.15)",
                    }}
                  >
                    <Tag className="h-3.5 w-3.5" style={{ color: isDefault ? "#C84B31" : "#2E9E8F" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="text" value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleEdit(cat); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus
                          className="flex-1 px-2 py-1 rounded text-sm font-dm outline-none min-w-0"
                          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FDFBF7" }} />
                        <button onClick={() => handleEdit(cat)} className="p-1 rounded hover:bg-white/[0.06]" style={{ color: "#22c55e" }}><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-white/[0.06]" style={{ color: "rgba(253,251,247,0.3)" }}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-cream truncate">{cat.name}</p>
                        <p className="text-[11px] text-cream/25">
                          {count > 0 ? `${count} curso${count !== 1 ? "s" : ""}` : "Sem cursos"}
                          {isDefault && " · Padrão"}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                    className="p-1.5 rounded-lg text-cream/15 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                    aria-label={`Editar ${cat.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    className="p-1.5 rounded-lg text-cream/15 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    aria-label={`Remover ${cat.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {categories.length === 0 && !loading && (
        <div className="text-center py-16">
          <BookOpen className="h-10 w-10 text-cream/15 mx-auto mb-3" />
          <p className="text-cream/35 text-sm">Nenhuma categoria configurada.</p>
        </div>
      )}

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remover categoria"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-cream/50">
              Tem certeza que deseja remover a categoria <span className="font-medium text-cream">&quot;{deleteTarget.name}&quot;</span>?
            </p>
            {DEFAULT_CATEGORIES.includes(deleteTarget.name) && (
              <div
                className="flex items-center gap-3 p-3 rounded-[10px]"
                style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
              >
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  Esta é uma categoria padrão. Você pode restaurá-la depois.
                </p>
              </div>
            )}
            {(coursesByCategory[deleteTarget.name] || []).length > 0 && (
              <div className="rounded-[10px] p-3 space-y-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <p className="text-xs text-red-300 font-medium">
                  {coursesByCategory[deleteTarget.name].length} curso(s) usam esta categoria e serão desassociados:
                </p>
                <div className="space-y-1">
                  {coursesByCategory[deleteTarget.name].map((c) => (
                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <BookOpen className="h-3 w-3 text-cream/30 flex-shrink-0" />
                      <span className="text-xs text-cream/70 truncate">{c.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" onClick={handleRemove}>
                Remover{(coursesByCategory[deleteTarget.name] || []).length > 0 ? " e desassociar" : ""}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
