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
  MessageCircle,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { CertificadoCondutor } from "@/types";

export default function CondutoresPage() {
  const { isAdmin } = useAuth();
  const [condutores, setCondutores] = useState<CertificadoCondutor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newNome, setNewNome] = useState("");

  const [editTarget, setEditTarget] = useState<CertificadoCondutor | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editObservacoes, setEditObservacoes] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<CertificadoCondutor | null>(null);

  useEffect(() => {
    async function fetch() {
      const client = createClient();
      const { data } = await client
        .from("certificado_condutores")
        .select("*")
        .order("nome");
      if (data) setCondutores(data);
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, []);

  const filtered = condutores.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd() {
    const nome = newNome.trim();
    if (!nome) return;
    setAdding(true);
    const client = createClient();
    const { data, error } = await client
      .from("certificado_condutores")
      .insert({ nome, ativo: true })
      .select("*")
      .single();

    if (error || !data) {
      toast.error("Erro ao adicionar condutor.");
      setAdding(false);
      return;
    }

    setCondutores((prev) =>
      [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setNewNome("");
    setAdding(false);
    toast.success(`Condutor "${nome}" adicionado!`);
  }

  async function handleToggleAtivo(item: CertificadoCondutor) {
    const client = createClient();
    const { error } = await client
      .from("certificado_condutores")
      .update({ ativo: !item.ativo })
      .eq("id", item.id);

    if (error) {
      toast.error("Erro ao atualizar status.");
      return;
    }

    setCondutores((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, ativo: !c.ativo } : c))
    );
    toast.success(item.ativo ? "Condutor desativado." : "Condutor ativado.");
  }

  function openEdit(item: CertificadoCondutor) {
    setEditTarget(item);
    setEditNome(item.nome);
    setEditTelefone(item.telefone || "");
    setEditObservacoes(item.observacoes || "");
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
      .from("certificado_condutores")
      .update({
        nome,
        telefone: editTelefone.trim() || null,
        observacoes: editObservacoes.trim() || null,
      })
      .eq("id", editTarget.id);

    if (error) {
      toast.error("Erro ao salvar alterações.");
      return;
    }

    setCondutores((prev) =>
      prev
        .map((c) =>
          c.id === editTarget.id
            ? {
                ...c,
                nome,
                telefone: editTelefone.trim() || null,
                observacoes: editObservacoes.trim() || null,
              }
            : c
        )
        .sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setEditTarget(null);
    toast.success("Condutor atualizado!");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const client = createClient();
    const { error } = await client
      .from("certificado_condutores")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Erro ao remover condutor.");
      return;
    }

    setCondutores((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Condutor removido.");
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="h-12 w-12 text-cream/20 mx-auto mb-4" />
        <h2 className="font-fraunces font-bold text-xl text-cream mb-2">
          Acesso restrito
        </h2>
        <p className="text-cream/40">
          Apenas administradores podem gerenciar condutores.
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
            Condutores
          </h1>
          <p className="text-sm text-cream/35 mt-1 font-dm">
            Gerencie os condutores disponíveis para certificados.
          </p>
        </div>
      </motion.div>

      {/* Add + Search */}
      <div
        className="flex flex-col sm:flex-row gap-3 mb-8 p-5 rounded-[16px]"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="relative flex-1">
          <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Nome do novo condutor..."
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
          />
        </div>
        <Button onClick={handleAdd} disabled={!newNome.trim() || adding} loading={adding}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
        <input
          type="text"
          placeholder="Buscar condutor..."
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
          <UserCircle className="h-10 w-10 text-cream/15 mx-auto mb-3" />
          <p className="text-cream/35 text-sm font-dm">
            {search ? "Nenhum condutor encontrado." : "Nenhum condutor cadastrado."}
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
                <div className="flex items-center gap-2.5">
                  <p className="text-sm font-medium text-cream font-dm truncate">
                    {item.nome}
                  </p>
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
                    {item.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                {item.telefone && (
                  <p className="text-[11px] text-cream/30 mt-0.5 font-dm">{item.telefone}</p>
                )}
                {item.observacoes && (
                  <p className="text-[11px] text-cream/25 mt-0.5 font-dm truncate max-w-md">
                    {item.observacoes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {item.telefone && (
                  <a
                    href={`https://wa.me/55${item.telefone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-cream/20 hover:text-green-400 hover:bg-green-400/10 transition-all"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
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
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar condutor">
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
              <label className="text-xs text-cream/40 font-dm mb-1 block">Telefone</label>
              <input
                type="text"
                value={editTelefone}
                onChange={(e) => setEditTelefone(e.target.value)}
                placeholder="11999999999"
                className="w-full px-4 py-2.5 dark-input rounded-[10px] text-sm font-dm"
              />
            </div>
            <div>
              <label className="text-xs text-cream/40 font-dm mb-1 block">Observações</label>
              <textarea
                value={editObservacoes}
                onChange={(e) => setEditObservacoes(e.target.value)}
                rows={3}
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
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remover condutor">
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
