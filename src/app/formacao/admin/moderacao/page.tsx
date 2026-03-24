"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import ReviewStars from "@/components/community/ReviewStars";
import { motion } from "framer-motion";
import { Trash2, Star, MessageSquare, User, AlertTriangle, ChevronDown, Reply, Send, Search } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils/format";
import { toast } from "sonner";

const DuvidasPage = dynamic(() => import("@/app/formacao/admin/duvidas/page"), { ssr: false });

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  course_id: string;
  user: { full_name: string; avatar_url: string | null } | null;
  course: { title: string } | null;
}

interface CommentItem {
  id: string;
  content: string;
  created_at: string;
  lesson_id: string;
  user: { full_name: string; avatar_url: string | null } | null;
  lesson: { title: string; section: { course_id: string; course: { title: string } | null } | null } | null;
}

interface CourseOption {
  id: string;
  title: string;
}

type Tab = "reviews" | "comments" | "duvidas";
type RatingFilter = "all" | "negative" | "neutral" | "positive";

export default function ModeracaoPage() {
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState<Tab>("reviews");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ type: Tab; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New filter states
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [search, setSearch] = useState("");

  // Reply states
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    async function fetch() {
      if (!isAdmin) {
        setLoading(false);
        return;
      }
      const client = createClient();

      const [reviewsRes, commentsRes, coursesRes] = await Promise.all([
        client
          .from("reviews")
          .select(`
            id, rating, comment, created_at, course_id,
            user:profiles!reviews_user_id_fkey(full_name, avatar_url),
            course:courses!reviews_course_id_fkey(title)
          `)
          .order("created_at", { ascending: false }),
        client
          .from("lesson_comments")
          .select(`
            id, content, created_at, lesson_id,
            user:profiles!lesson_comments_user_id_fkey(full_name, avatar_url),
            lesson:lessons!lesson_comments_lesson_id_fkey(title, section:sections!lessons_section_id_fkey(course_id, course:courses!sections_course_id_fkey(title)))
          `)
          .order("created_at", { ascending: false }),
        client
          .from("courses")
          .select("id, title")
          .order("title"),
      ]);

      if (reviewsRes.data) setReviews(reviewsRes.data as ReviewItem[]);
      if (commentsRes.data) setComments(commentsRes.data as CommentItem[]);
      if (coursesRes.data) setCourses(coursesRes.data as CourseOption[]);
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, [isAdmin]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    let result = reviews;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        r.user?.full_name?.toLowerCase().includes(s) ||
        r.comment?.toLowerCase().includes(s) ||
        r.course?.title?.toLowerCase().includes(s)
      );
    }
    if (selectedCourseId !== "all") {
      result = result.filter((r) => r.course_id === selectedCourseId);
    }
    if (ratingFilter === "negative") {
      result = result.filter((r) => r.rating >= 1 && r.rating <= 2);
    } else if (ratingFilter === "neutral") {
      result = result.filter((r) => r.rating === 3);
    } else if (ratingFilter === "positive") {
      result = result.filter((r) => r.rating >= 4 && r.rating <= 5);
    }
    return result;
  }, [reviews, selectedCourseId, ratingFilter, search]);

  // Filtered comments
  const filteredComments = useMemo(() => {
    let result = comments;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((c) =>
        c.user?.full_name?.toLowerCase().includes(s) ||
        c.content?.toLowerCase().includes(s)
      );
    }
    if (selectedCourseId !== "all") {
      result = result.filter((c) => c.lesson?.section?.course_id === selectedCourseId);
    }
    return result;
  }, [comments, selectedCourseId, search]);

  // Stats
  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / reviews.length;
  }, [reviews]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const client = createClient();

    const table = deleteTarget.type === "reviews" ? "reviews" : "lesson_comments";
    const { error } = await client.from(table).delete().eq("id", deleteTarget.id);

    if (error) {
      toast.error("Erro ao excluir.");
      setDeleting(false);
      return;
    }

    if (deleteTarget.type === "reviews") {
      setReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    } else {
      setComments((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    }

    toast.success("Excluído com sucesso.");
    setDeleteTarget(null);
    setDeleting(false);
  }

  async function handleReply(comment: CommentItem) {
    if (!replyText.trim() || !user) return;
    setSendingReply(true);
    const client = createClient();

    const { data, error } = await client
      .from("lesson_comments")
      .insert({
        lesson_id: comment.lesson_id,
        user_id: user.id,
        content: replyText.trim(),
      })
      .select(`
        id, content, created_at, lesson_id,
        user:profiles!lesson_comments_user_id_fkey(full_name, avatar_url),
        lesson:lessons!lesson_comments_lesson_id_fkey(title, section:sections!lessons_section_id_fkey(course_id, course:courses!sections_course_id_fkey(title)))
      `)
      .single();

    if (error) {
      toast.error("Erro ao responder.");
      setSendingReply(false);
      return;
    }

    if (data) {
      setComments((prev) => [data as CommentItem, ...prev]);
    }

    toast.success("Resposta enviada com sucesso.");
    setReplyText("");
    setReplyingTo(null);
    setSendingReply(false);
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-40 mb-8" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
          Moderação
        </h1>
        <p className="text-sm text-cream/35 mt-1">
          Gerencie avaliações e comentários da plataforma.
        </p>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap items-center gap-3 mb-6 px-4 py-3 rounded-[12px]"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-accent" />
          <span className="text-sm text-cream/60">
            <span className="text-cream font-semibold">{reviews.length}</span> avaliações
          </span>
        </div>
        <span className="text-cream/15">·</span>
        <span className="text-sm text-cream/60">
          Rating médio: <span className="text-cream font-semibold">{averageRating.toFixed(1)}</span>
        </span>
        <span className="text-cream/15">·</span>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <span className="text-sm text-cream/60">
            <span className="text-cream font-semibold">{comments.length}</span> comentários
          </span>
        </div>
      </motion.div>

      {/* Filters row */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center gap-3 mb-6"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Buscar por nome ou conteúdo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 dark-input rounded-[10px] text-sm"
          />
        </div>

        {/* Course filter */}
        <div className="relative">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="appearance-none pl-4 pr-9 py-2 rounded-[10px] text-sm text-cream bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <option value="all" className="bg-[#1a1a1a] text-cream">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#1a1a1a] text-cream">
                {c.title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/30 pointer-events-none" />
        </div>

        {/* Rating filter (reviews tab only) */}
        {tab === "reviews" && (
          <div
            className="flex gap-0.5 p-1 rounded-[10px]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {([
              { key: "all", label: "Todas" },
              { key: "negative", label: "★1-2" },
              { key: "neutral", label: "★3" },
              { key: "positive", label: "★4-5" },
            ] as { key: RatingFilter; label: string }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRatingFilter(opt.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-[8px] transition-all duration-200 ${
                  ratingFilter === opt.key
                    ? "text-white font-semibold"
                    : "text-cream/40 hover:text-cream/70"
                }`}
                style={
                  ratingFilter === opt.key
                    ? { background: "linear-gradient(135deg, #C84B31, #A33D27)" }
                    : {}
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-[12px] p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={() => setTab("reviews")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-[10px] transition-all duration-200 ${
            tab === "reviews" ? "text-white font-semibold" : "text-cream/40 hover:text-cream/70"
          }`}
          style={tab === "reviews" ? { background: "linear-gradient(135deg, #C84B31, #A33D27)" } : {}}
        >
          <Star className="h-4 w-4" />
          Avaliações ({filteredReviews.length})
        </button>
        <button
          onClick={() => setTab("comments")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-[10px] transition-all duration-200 ${
            tab === "comments" ? "text-white font-semibold" : "text-cream/40 hover:text-cream/70"
          }`}
          style={tab === "comments" ? { background: "linear-gradient(135deg, #C84B31, #A33D27)" } : {}}
        >
          <MessageSquare className="h-4 w-4" />
          Comentários ({filteredComments.length})
        </button>
        <button
          onClick={() => setTab("duvidas")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-[10px] transition-all duration-200 ${
            tab === "duvidas" ? "text-white font-semibold" : "text-cream/40 hover:text-cream/70"
          }`}
          style={tab === "duvidas" ? { background: "linear-gradient(135deg, #C84B31, #A33D27)" } : {}}
        >
          Dúvidas
        </button>
      </div>

      {/* Reviews */}
      {tab === "reviews" && (
        <div className="space-y-3">
          {filteredReviews.length === 0 ? (
            <p className="text-center text-cream/35 py-12">Nenhuma avaliação encontrada.</p>
          ) : (
            filteredReviews.map((review) => (
              <div
                key={review.id}
                className="flex gap-4 p-4 rounded-[12px] border border-white/[.06] hover:border-white/[.1] transition-colors"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(200,75,49,0.1)" }}
                >
                  {review.user?.avatar_url ? (
                    <img src={review.user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-cream">{review.user?.full_name || "Anônimo"}</span>
                    <ReviewStars value={review.rating} size="sm" />
                    <span className="text-xs text-cream/25">{formatRelativeDate(review.created_at)}</span>
                  </div>
                  <p className="text-xs text-cream/30 mb-1">Curso: {review.course?.title}</p>
                  {review.comment && (
                    <p className="text-sm text-cream/50 leading-relaxed">{review.comment}</p>
                  )}
                </div>
                <button
                  onClick={() => setDeleteTarget({ type: "reviews", id: review.id, label: `avaliação de ${review.user?.full_name || "Anônimo"}` })}
                  className="p-2 rounded-lg text-cream/20 hover:text-red-400 hover:bg-red-400/10 transition-all self-start flex-shrink-0"
                  aria-label="Excluir avaliação"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Comments */}
      {tab === "comments" && (
        <div className="space-y-3">
          {filteredComments.length === 0 ? (
            <p className="text-center text-cream/35 py-12">Nenhum comentário encontrado.</p>
          ) : (
            filteredComments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-[12px] border border-white/[.06] hover:border-white/[.1] transition-colors"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex gap-4 p-4">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(200,75,49,0.1)" }}
                  >
                    {comment.user?.avatar_url ? (
                      <img src={comment.user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-cream">{comment.user?.full_name || "Anônimo"}</span>
                      <span className="text-xs text-cream/25">{formatRelativeDate(comment.created_at)}</span>
                    </div>
                    <p className="text-xs text-cream/30 mb-1">
                      Aula: {comment.lesson?.title}
                      {comment.lesson?.section?.course?.title && (
                        <span className="text-cream/20"> · {comment.lesson.section.course.title}</span>
                      )}
                    </p>
                    <p className="text-sm text-cream/50 leading-relaxed">{comment.content}</p>

                    {/* Reply button */}
                    <button
                      onClick={() => {
                        setReplyingTo(replyingTo === comment.id ? null : comment.id);
                        setReplyText("");
                      }}
                      className="mt-2 flex items-center gap-1.5 text-xs text-cream/30 hover:text-accent transition-colors"
                    >
                      <Reply className="h-3.5 w-3.5" />
                      Responder
                    </button>
                  </div>
                  <button
                    onClick={() => setDeleteTarget({ type: "comments", id: comment.id, label: `comentário de ${comment.user?.full_name || "Anônimo"}` })}
                    className="p-2 rounded-lg text-cream/20 hover:text-red-400 hover:bg-red-400/10 transition-all self-start flex-shrink-0"
                    aria-label="Excluir comentário"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Inline reply input */}
                {replyingTo === comment.id && (
                  <div
                    className="px-4 pb-4 pt-0"
                  >
                    <div
                      className="flex items-center gap-2 p-2 rounded-[10px]"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <input
                        type="text"
                        placeholder="Escreva sua resposta..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleReply(comment);
                          }
                        }}
                        className="flex-1 bg-transparent text-sm text-cream placeholder:text-cream/25 focus:outline-none px-2 py-1"
                        autoFocus
                      />
                      <button
                        onClick={() => handleReply(comment)}
                        disabled={!replyText.trim() || sendingReply}
                        className="p-2 rounded-[8px] text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                        style={{ background: replyText.trim() ? "linear-gradient(135deg, #C84B31, #A33D27)" : "rgba(255,255,255,0.05)" }}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Dúvidas */}
      {tab === "duvidas" && <DuvidasPage />}

      {/* Categorias */}

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar exclusão"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <div
              className="flex items-center gap-3 p-3 rounded-[10px]"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
            >
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-cream/60">
                Tem certeza que deseja excluir a {deleteTarget.label}? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>Excluir</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
