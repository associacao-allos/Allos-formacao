"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Shield,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  RefreshCw,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import type { CertificadoAtividade } from "@/types";

export default function AtividadesPage() {
  const { isAdmin } = useAuth();
  const [atividades, setAtividades] = useState<CertificadoAtividade[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newCarga, setNewCarga] = useState(2);

  const [editTarget, setEditTarget] = useState<CertificadoAtividade | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCarga, setEditCarga] = useState(2);
  const [editDescricao, setEditDescricao] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<CertificadoAtividade | null>(null);

  useEffect(() => {
    async function fetch() {
      const client = createClient();
      const { data } = await client
        .from("certificado_atividades")
        .select("*")
        .order("nome");
      if (data) setAtividades(data);
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, []);

  const filtered = atividades.filter((a) =>
    a.nome.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd() {
    const nome = newNome.trim();
    if (!nome) return;
    if (atividades.some((a) => a.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error("Essa atividade já existe.");
      return;
    }

    setAdding(true);
    const client = createClient();
    const { data, error } = await client
      .from("certificado_atividades")
      .insert({ nome, carga_horaria: newCarga })
      .select("*")
      .single();

    if (error || !data) {
      toast.error("Erro ao adicionar atividade.");
      setAdding(false);
      return;
    }

    setAtividades((prev) =>
      [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setNewNome("");
    setNewCarga(2);
    setAdding(false);
    toast.success(`Atividade "${nome}" adicionada!`);
  }

  async function handleSync() {
    setSyncing(true);
    const client = createClient();

    const { data: submissions } = await client
      .from("certificado_submissions")
      .select("atividade_nome");

    if (!submissions) {
      toast.error("Erro ao buscar feedbacks.");
      setSyncing(false);
      return;
    }

    const uniqueNames = Array.from(new Set(
      submissions
        .map((s: { atividade_nome: string }) => s.atividade_nome?.trim())
        .filter(Boolean) as string[]
    ));

    const existingNames = new Set(atividades.map((a) => a.nome.toLowerCase()));
    const toInsert = uniqueNames.filter(
      (name) => !existingNames.has(name.toLowerCase())
    );

    if (toInsert.length === 0) {
      toast.info("Nenhuma atividade nova encontrada nos feedbacks.");
      setSyncing(false);
      return;
    }

    const { data: inserted, error } = await client
      .from("certificado_atividades")
      .insert(toInsert.map((nome) => ({ nome, ativo: false })))
      .select("*");

    if (error) {
      toast.error("Erro ao sincronizar atividades.");
      setSyncing(false);
      return;
    }

    if (inserted) {
      setAtividades((prev) =>
        [...prev, ...inserted].sort((a, b) => a.nome.localeCompare(b.nome))
      );
    }

    setSyncing(false);
    toast.success(`${toInsert.length} atividade(s) importada(s) dos feedbacks.`);
  }

  async function handleToggleAtivo(item: CertificadoAtividade) {
    const client = createClient();
    const { error } = await client
      .from("certificado_atividades")
      .update({ ativo: !item.ativo })
      .eq("id", item.id);

    if (error) {
      toast.error("Erro ao atualizar status.");
      return;
    }

    setAtividades((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, ativo: !a.ativo } : a))
    );
    toast.success(item.ativo ? "Atividade desativada." : "Atividade ativada.");
  }

  function openEdit(item: CertificadoAtividade) {
    setEditTarget(item);
    setEditNome(item.nome);
    setEditCarga(item.carga_horaria);
    setEditDescricao(item.descricao || "");
  }

  async function handleEditSave() {
    if (!editTarget) return;
    const nome = editNome.trim();
    if (!nome) {
      toast.error("Nome é obrigatório.");
      return;
    }

    const client = createClient();
    const { error } = await client
      .from("certificado_atividades")
      .update({
        nome,
        carga_horaria: editCarga,
        descricao: editDescricao.trim() || null,
      })
      .eq("id", editTarget.id);

    if (error) {
      toast.error("Erro ao salvar alterações.");
      return;
    }

    setAtividades((prev) =>
      prev
        .map((a) =>
          a.id === editTarget.id
            ? {
                ...a,
                nome,
                carga_horaria: editCarga,
                descricao: editDescricao.trim() || null,
              }
            : a
        )
        .sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setEditTarget(null);
    toast.success("Atividade atualizada!");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const client = createClient();
    const { error } = await client
      .from("certificado_atividades")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Erro ao remover atividade.");
      return;
    }

    setAtividades((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Atividade removida.");
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="h-12 w-12 text-cream/20 mx-auto mb-4" />
        <h2 className="font-fraunces font-bold text-xl text-cream mb-2">
          Acesso restrito
        </h2>
        <p className="text-cream/40">
          Apenas administradores podem gerenciar atividades.
        </p>
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
            Atividades
          </h1>
          <p className="text-sm text-cream/35 mt-1 font-dm">
            Gerencie os tipos de atividades para certificados de formação.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          loading={syncing}
        >
          <RefreshCw className="h-4 w-4" />
          Sincronizar feedbacks
        </Button>
      </motion.div>

      {/* Add new atividade */}
      <div
        className="flex flex-col sm:flex-row gap-3 mb-2 p-5 rounded-[16px]"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="relative flex-1">
          <Activity className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Nome da nova atividade..."
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={100}
            value={newCarga}
            onChange={(e) => setNewCarga(Number(e.target.value))}
            className="w-20 px-3 py-2.5 dark-input rounded-[10px] text-sm font-dm text-center"
          />
          <span className="text-xs text-cream/40 font-dm">h</span>
        </div>
        <Button onClick={handleAdd} disabled={!newNome.trim() || adding} loading={adding}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>
      <p className="text-[11px] text-cream/30 font-dm mb-8 ml-1">
        👁 = publicada no formulário de certificação
      </p>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
        <input
          type="text"
          placeholder="Buscar atividade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-[12px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="h-10 w-10 text-cream/15 mx-auto mb-3" />
          <p className="text-cream/35 text-sm font-dm">
            {search ? "Nenhuma atividade encontrada." : "Nenhuma atividade cadastrada."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between p-4 rounded-[12px] group transition-all duration-200 hover:bg-white/[.02]"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <p className="text-sm font-medium text-cream font-dm">
                    {item.nome}
                  </p>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium font-dm"
                    style={{
                      background: "rgba(200,75,49,0.08)",
                      color: "#C84B31",
                      border: "1px solid rgba(200,75,49,0.15)",
                    }}
                  >
                    {item.carga_horaria}h
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium font-dm"
                    style={{
                      background: item.ativo
                        ? "rgba(46,158,143,0.1)"
                        : "rgba(255,255,255,0.04)",
                      color: item.ativo ? "#2E9E8F" : "rgba(253,251,247,0.3)",
                      border: item.ativo
                        ? "1px solid rgba(46,158,143,0.2)"
                        : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {item.ativo ? "Ativa" : "Inativa"}
                  </span>
                </div>
                {item.descricao && (
                  <p className="text-[11px] text-cream/25 mt-0.5 font-dm truncate max-w-md">
                    {item.descricao}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => handleToggleAtivo(item)}
                  className="p-1.5 rounded-lg text-cream/20 hover:text-cream/60 hover:bg-white/[.04] transition-all"
                  aria-label={item.ativo ? "Desativar" : "Ativar"}
                >
                  {item.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => openEdit(item)}
                  className="p-1.5 rounded-lg text-cream/20 hover:text-[#C84B31] hover:bg-[#C84B31]/10 transition-all"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(item)}
                  className="p-1.5 rounded-lg text-cream/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar atividade">
        {editTarget && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-cream/40 font-dm mb-1 block">Nome</label>
              <input
                type="text"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="w-full px-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
              />
            </div>
            <div>
              <label className="text-xs text-cream/40 font-dm mb-1 block">
                Carga horária (horas)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={editCarga}
                onChange={(e) => setEditCarga(Number(e.target.value))}
                className="w-full px-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
              />
            </div>
            <div>
              <label className="text-xs text-cream/40 font-dm mb-1 block">Descrição</label>
              <textarea
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                rows={3}
                placeholder="Descrição opcional..."
                className="w-full px-4 py-2.5 dark-input rounded-[10px] text-sm font-dm resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button onClick={handleEditSave}>Salvar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remover atividade">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-cream/50 font-dm">
              Tem certeza que deseja remover{" "}
              <span className="font-medium text-cream">"{deleteTarget.nome}"</span>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Remover
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
