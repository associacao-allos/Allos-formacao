"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import { useCategories } from "@/hooks/useCategories";
import { slugify } from "@/lib/utils/format";
import { detectVideoSource } from "@/lib/utils/video";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Upload,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Sparkles,
  Clock,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Course, Section, Lesson, ExamQuestion, ExamOption } from "@/types";

interface CourseFormProps {
  courseId?: string;
}

type Step = "info" | "content" | "exam" | "certificate";

const ALL_STEPS: { id: Step; label: string }[] = [
  { id: "info", label: "Informações" },
  { id: "content", label: "Conteúdo" },
  { id: "exam", label: "Prova" },
  { id: "certificate", label: "Certificado" },
];

const SYNC_STEPS: { id: Step; label: string }[] = [
  { id: "info", label: "Informações" },
  { id: "content", label: "Conteúdo" },
];

// Helper: extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Helper: check if URL is Vimeo
function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/.test(url);
}

// Category picker with create-new inline
function CategoryPicker({ categories, value, onChange }: { categories: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const name = newCat.trim();
    if (!name) return;
    setCreating(true);
    const { error } = await createClient().from("categories").insert({ name });
    setCreating(false);
    if (error) { toast.error("Erro ao criar categoria"); return; }
    onChange(name);
    setNewCat("");
    setOpen(false);
    toast.success(`Categoria "${name}" criada`);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-cream/70">Categoria</label>
      <div className="relative">
        <button type="button" onClick={() => setOpen(!open)}
          className="w-full px-4 py-2.5 rounded-[10px] dark-input text-sm font-dm text-left flex items-center justify-between">
          <span style={{ color: value ? "#FDFBF7" : "rgba(253,251,247,0.3)" }}>{value || "Selecione uma categoria"}</span>
          <svg className="h-4 w-4 text-cream/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg py-1 max-h-60 overflow-auto"
              style={{ backgroundColor: "#1E1E1E", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
              {value && (
                <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-dm hover:bg-white/[0.04]" style={{ color: "rgba(253,251,247,0.3)" }}>
                  Limpar seleção
                </button>
              )}
              {categories.map(c => (
                <button type="button" key={c} onClick={() => { onChange(c); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm font-dm hover:bg-white/[0.04]"
                  style={{ color: c === value ? "#C84B31" : "rgba(253,251,247,0.7)" }}>
                  {c}
                </button>
              ))}
              <div className="border-t border-white/[0.06] mt-1 pt-1 px-2 pb-1">
                <div className="flex gap-1.5">
                  <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleCreate())}
                    placeholder="Nova categoria..."
                    className="flex-1 px-2.5 py-1.5 rounded text-xs font-dm outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#FDFBF7" }} />
                  <button type="button" onClick={handleCreate} disabled={creating || !newCat.trim()}
                    className="px-2.5 py-1.5 rounded text-xs font-dm font-bold disabled:opacity-30"
                    style={{ backgroundColor: "#C84B31", color: "#fff" }}>
                    {creating ? "..." : "+"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SortableItem({ id, children }: { id: string; children: (props: { dragHandleProps: Record<string, unknown> }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : "auto" as const,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ dragHandleProps: listeners as Record<string, unknown> })}
    </div>
  );
}

export default function CourseForm({ courseId }: CourseFormProps) {
  const router = useRouter();
  const { profile, isAdmin } = useAuth();
  const { categories: availableCategories } = useCategories();
  const isEdit = !!courseId;

  const [step, setStep] = useState<Step>("info");
  const [saving, setSaving] = useState(false);

  // Basic info
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [category, setCategory] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [priceCents, setPriceCents] = useState(0);
  const [instructorId, setInstructorId] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [courseType, setCourseType] = useState<"async" | "sync">("async");
  const [defaultLessonThumbnail, setDefaultLessonThumbnail] = useState("");
  const STEPS = courseType === "sync" ? SYNC_STEPS : ALL_STEPS;
  const [learningPoints, setLearningPoints] = useState<string[]>([""]);

  // Content
  const [sections, setSections] = useState<
    (Section & { lessons: (Lesson & { _new?: boolean })[] })[]
  >([]);

  // Exam
  const [examEnabled, setExamEnabled] = useState(false);
  const [examPassingScore, setExamPassingScore] = useState(70);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);

  // Certificate
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [certificateHours, setCertificateHours] = useState<number | null>(null);
  const [certificateBodyText, setCertificateBodyText] = useState("");

  // Instructors list (for admin)
  const [instructors, setInstructors] = useState<
    { value: string; label: string }[]
  >([]);

  // Default duration input
  const [defaultDuration, setDefaultDuration] = useState(90);

  // --- NEW STATE: delete confirmation ---
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // --- NEW STATE: unsaved changes tracking ---
  const [isDirty, setIsDirty] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // --- Autosave state ---
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // --- NEW: beforeunload warning ---
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // --- NEW: mark dirty helper ---
  const markDirty = useCallback(() => {
    if (initialLoadDone) setIsDirty(true);
  }, [initialLoadDone]);

  // --- Autosave effect (only for existing courses) ---
  useEffect(() => {
    if (!isEdit || !isDirty || !initialLoadDone) return;

    // Clear any existing timer
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      saveCourse({ silent: true });
    }, 30_000);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, isEdit, initialLoadDone]);

  // --- Cleanup autosave timer on unmount ---
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);

  // Load data
  useEffect(() => {
    async function load() {
      // Load instructors list
      if (isAdmin) {
        const { data } = await createClient()
          .from("profiles")
          .select("id, full_name")
          .in("role", ["instructor", "admin"]);
        if (data) {
          setInstructors(
            data.map((p) => ({ value: p.id, label: p.full_name }))
          );
        }
      }

      if (profile) {
        setInstructorId(profile.id);
      }

      if (!courseId) {
        setInitialLoadDone(true);
        return;
      }

      // Load course
      const { data: course } = await createClient()
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (!course) {
        router.push("/formacao/admin/cursos");
        return;
      }

      setTitle(course.title);
      setSlug(course.slug);
      setDescription(course.description || "");
      setLongDescription(course.long_description || "");
      setCategory(course.category || "");
      setThumbnailUrl(course.thumbnail_url || "");
      setIsFree(course.is_free);
      setPriceCents(course.price_cents || 0);
      setInstructorId(course.instructor_id);
      setStatus(course.status);
      setExamEnabled(course.exam_enabled);
      setExamPassingScore(course.exam_passing_score);
      setCertificateEnabled(course.certificate_enabled);
      setCertificateHours(course.certificate_hours ?? null);
      setCertificateBodyText(course.certificate_body_text || "");
      setWhatsappNumber(course.whatsapp_number || "");
      setCourseType(course.course_type || "async");
      setDefaultLessonThumbnail(course.default_lesson_thumbnail_url || "");
      setLearningPoints(course.learning_points || [""]);

      // Load sections + lessons
      const { data: sectionsData } = await createClient()
        .from("sections")
        .select("*, lessons(*, attachments:lesson_attachments(*))")
        .eq("course_id", courseId)
        .order("position")
        .order("position", { referencedTable: "lessons" });

      if (sectionsData) {
        setSections(sectionsData as typeof sections);
      }

      // Load exam questions
      const { data: questionsData } = await createClient()
        .from("exam_questions")
        .select("*")
        .eq("course_id", courseId)
        .order("position");

      if (questionsData) setQuestions(questionsData);

      setInitialLoadDone(true);
    }

    load();
  }, [courseId, profile, isAdmin, router]);

  // Auto-generate slug
  useEffect(() => {
    if (!isEdit) {
      setSlug(slugify(title));
    }
  }, [title, isEdit]);

  async function saveCourse(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    // Cancel pending autosave when saving manually
    if (!silent && autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    if (!title.trim() || !slug.trim()) {
      if (!silent) toast.error("Título e slug são obrigatórios.");
      return;
    }

    if (silent) {
      setIsAutoSaving(true);
    } else {
      setSaving(true);
    }

    const courseData = {
      title,
      slug,
      description: description || null,
      long_description: longDescription || null,
      category: category || null,
      thumbnail_url: thumbnailUrl || null,
      is_free: isFree,
      price_cents: isFree ? null : priceCents,
      instructor_id: instructorId,
      status,
      exam_enabled: examEnabled,
      exam_passing_score: examPassingScore,
      certificate_enabled: certificateEnabled,
      certificate_hours: certificateHours,
      certificate_body_text: certificateBodyText || null,
      whatsapp_number: whatsappNumber || null,
      course_type: courseType,
      default_lesson_thumbnail_url: defaultLessonThumbnail || null,
      learning_points: learningPoints.filter((p) => p.trim()),
    };

    let savedCourseId = courseId;

    if (isEdit) {
      const { error } = await createClient()
        .from("courses")
        .update(courseData)
        .eq("id", courseId);

      if (error) {
        if (!silent) toast.error("Erro ao atualizar curso.");
        if (silent) setIsAutoSaving(false); else setSaving(false);
        return;
      }
    } else {
      const { data, error } = await createClient()
        .from("courses")
        .insert(courseData)
        .select("id")
        .single();

      if (error || !data) {
        if (!silent) toast.error("Erro ao criar curso.");
        if (silent) setIsAutoSaving(false); else setSaving(false);
        return;
      }
      savedCourseId = data.id;
    }

    // Save sections and lessons
    if (savedCourseId) {
      for (let si = 0; si < sections.length; si++) {
        const section = sections[si];
        let sectionId = section.id;

        if (section.id.startsWith("new-")) {
          const { data, error } = await createClient()
            .from("sections")
            .insert({
              course_id: savedCourseId,
              title: section.title,
              position: si,
              is_extra: section.is_extra ?? false,
            })
            .select("id")
            .single();

          if (error || !data) continue;
          sectionId = data.id;
        } else {
          await createClient()
            .from("sections")
            .update({ title: section.title, position: si, is_extra: section.is_extra ?? false })
            .eq("id", sectionId);
        }

        // Save lessons
        for (let li = 0; li < section.lessons.length; li++) {
          const lesson = section.lessons[li];

          const lessonData = {
            section_id: sectionId,
            title: lesson.title,
            description: lesson.description || null,
            video_url: lesson.video_url || null,
            video_source: lesson.video_url
              ? detectVideoSource(lesson.video_url)
              : null,
            thumbnail_url: lesson.thumbnail_url || null,
            duration_minutes: lesson.duration_minutes || null,
            position: li,
            is_preview: lesson.is_preview,
          };

          if (lesson.id.startsWith("new-")) {
            await createClient().from("lessons").insert(lessonData);
          } else {
            await createClient()
              .from("lessons")
              .update(lessonData)
              .eq("id", lesson.id);
          }
        }
      }

      // Save exam questions
      if (examEnabled) {
        // Delete existing then reinsert for simplicity
        await createClient()
          .from("exam_questions")
          .delete()
          .eq("course_id", savedCourseId);

        for (let qi = 0; qi < questions.length; qi++) {
          const q = questions[qi];
          await createClient().from("exam_questions").insert({
            course_id: savedCourseId,
            question_text: q.question_text,
            options: q.options,
            position: qi,
          });
        }
      }
    }

    setIsDirty(false);

    if (silent) {
      setLastAutoSaved(new Date());
      setIsAutoSaving(false);
    } else {
      toast.success(isEdit ? "Curso atualizado!" : "Curso criado!");
      router.push("/formacao/admin/cursos");
      setSaving(false);
    }
  }

  // Section helpers
  function addSection(isExtra = false) {
    markDirty();
    setSections((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        course_id: courseId || "",
        title: isExtra ? `Módulo Extra ${prev.filter(s => s.is_extra).length + 1}` : `Módulo ${prev.filter(s => !s.is_extra).length + 1}`,
        position: prev.length,
        is_extra: isExtra,
        created_at: new Date().toISOString(),
        lessons: [],
      },
    ]);
  }

  function addLesson(sectionIndex: number) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIndex] };
      section.lessons = [
        ...section.lessons,
        {
          id: `new-${Date.now()}`,
          section_id: section.id,
          title: "",
          description: null,
          video_url: null,
          video_source: null,
          thumbnail_url: null,
          duration_minutes: null,
          position: section.lessons.length,
          is_preview: false,
          created_at: new Date().toISOString(),
          _new: true,
        },
      ];
      next[sectionIndex] = section;
      return next;
    });
  }

  function updateSection(index: number, title: string) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], title };
      return next;
    });
  }

  function removeSection(index: number) {
    markDirty();
    setSections((prev) => prev.filter((_, i) => i !== index));
    setDeleteConfirmId(null);
  }

  function updateLesson(
    sectionIdx: number,
    lessonIdx: number,
    field: string,
    value: string | number | boolean | null
  ) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIdx] };
      const lessons = [...section.lessons];
      lessons[lessonIdx] = { ...lessons[lessonIdx], [field]: value };
      section.lessons = lessons;
      next[sectionIdx] = section;
      return next;
    });
  }

  function removeLesson(sectionIdx: number, lessonIdx: number) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIdx] };
      section.lessons = section.lessons.filter((_, i) => i !== lessonIdx);
      next[sectionIdx] = section;
      return next;
    });
    setDeleteConfirmId(null);
  }

  // Move helpers
  function moveSection(from: number, to: number) {
    if (to < 0 || to >= sections.length) return;
    markDirty();
    setSections((prev) => arrayMove(prev, from, to));
  }

  function moveLesson(sectionIdx: number, from: number, to: number) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIdx] };
      if (to < 0 || to >= section.lessons.length) return prev;
      section.lessons = arrayMove([...section.lessons], from, to);
      next[sectionIdx] = section;
      return next;
    });
  }

  function moveLessonToSection(fromSectionIdx: number, lessonIdx: number, toSectionIdx: number) {
    if (toSectionIdx < 0 || toSectionIdx >= sections.length || fromSectionIdx === toSectionIdx) return;
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const fromSection = { ...next[fromSectionIdx] };
      const toSection = { ...next[toSectionIdx] };
      const [lesson] = fromSection.lessons.splice(lessonIdx, 1);
      toSection.lessons = [...toSection.lessons, { ...lesson, section_id: toSection.id }];
      next[fromSectionIdx] = fromSection;
      next[toSectionIdx] = toSection;
      return next;
    });
  }

  // Default duration for all lessons in a section
  function setDefaultDurationForSection(sectionIdx: number, duration: number) {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIdx] };
      section.lessons = section.lessons.map((l) => ({
        ...l,
        duration_minutes: duration,
      }));
      next[sectionIdx] = section;
      return next;
    });
  }

  // Default duration for ALL lessons
  function setDefaultDurationForAll(duration: number) {
    markDirty();
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        lessons: section.lessons.map((l) => ({
          ...l,
          duration_minutes: duration,
        })),
      }))
    );
  }

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      moveSection(oldIndex, newIndex);
    }
  }

  function handleLessonDragEnd(sectionIdx: number) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const lessons = sections[sectionIdx].lessons;
        const oldIndex = lessons.findIndex((l) => l.id === active.id);
        const newIndex = lessons.findIndex((l) => l.id === over.id);
        moveLesson(sectionIdx, oldIndex, newIndex);
      }
    };
  }

  // Exam helpers
  function addQuestion() {
    markDirty();
    setQuestions((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        course_id: courseId || "",
        question_text: "",
        options: [
          { id: `opt-${Date.now()}-1`, text: "", is_correct: true },
          { id: `opt-${Date.now()}-2`, text: "", is_correct: false },
        ],
        position: prev.length,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  function updateQuestion(index: number, text: string) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], question_text: text };
      return next;
    });
  }

  function addOption(qIndex: number) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[qIndex] };
      q.options = [
        ...q.options,
        { id: `opt-${Date.now()}`, text: "", is_correct: false },
      ];
      next[qIndex] = q;
      return next;
    });
  }

  function updateOption(qIndex: number, oIndex: number, text: string) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[qIndex] };
      const opts = [...q.options];
      opts[oIndex] = { ...opts[oIndex], text };
      q.options = opts;
      next[qIndex] = q;
      return next;
    });
  }

  function setCorrectOption(qIndex: number, oIndex: number) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[qIndex] };
      q.options = q.options.map((o, i) => ({
        ...o,
        is_correct: i === oIndex,
      }));
      next[qIndex] = q;
      return next;
    });
  }

  function removeOption(qIndex: number, oIndex: number) {
    markDirty();
    setQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[qIndex] };
      q.options = q.options.filter((_, i) => i !== oIndex);
      next[qIndex] = q;
      return next;
    });
  }

  function removeQuestion(index: number) {
    markDirty();
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  // --- NEW: Video URL preview component ---
  function VideoUrlPreview({ url }: { url: string | null }) {
    if (!url || !url.trim()) return null;

    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      return (
        <div className="mt-1.5">
          <img
            src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
            alt="YouTube thumbnail"
            className="w-32 h-auto rounded border border-border/50"
          />
        </div>
      );
    }

    if (isVimeoUrl(url)) {
      return (
        <p className="mt-1.5 text-xs text-muted italic">Vimeo video</p>
      );
    }

    return null;
  }

  function handleStatusChange(newStatus: string) {
    const typedStatus = newStatus as "draft" | "published" | "archived";
    markDirty();
    setStatus(typedStatus);
  }

  return (
    <div>
      <h1 className="font-fraunces font-bold text-2xl text-charcoal mb-8">
        {isEdit ? "Editar curso" : "Novo curso"}
      </h1>

      {/* Stepper */}
      <div className="flex gap-1 mb-8 rounded-[12px] p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {STEPS.map((s) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`
              flex-1 py-2.5 text-sm font-medium rounded-[10px] transition-all duration-200
              ${
                step === s.id
                  ? "text-white font-semibold"
                  : "text-cream/40 hover:text-cream/70"
              }
            `}
            style={
              step === s.id
                ? { background: "linear-gradient(135deg, #C84B31, #A33D27)", boxShadow: "0 2px 8px rgba(200,75,49,0.25)" }
                : {}
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Info step */}
      {step === "info" && (
        <div className="space-y-6 max-w-2xl">
          <Input
            label="Título do curso"
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            required
            placeholder="Ex: Introdução à Psicoterapia"
          />
          <Input
            label="Slug (URL)"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); markDirty(); }}
            required
            placeholder="introducao-psicoterapia"
          />
          <Textarea
            label="Descrição curta"
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            placeholder="Aparece no card do curso"
            rows={3}
          />
          <Textarea
            label="Descrição longa (Markdown)"
            value={longDescription}
            onChange={(e) => { setLongDescription(e.target.value); markDirty(); }}
            placeholder="Descrição completa. Suporta Markdown."
            rows={8}
          />
          <CategoryPicker
            categories={availableCategories}
            value={category}
            onChange={(v) => { setCategory(v); markDirty(); }}
          />
          <Input
            label="URL da thumbnail (capa do curso)"
            value={thumbnailUrl}
            onChange={(e) => { setThumbnailUrl(e.target.value); markDirty(); }}
            placeholder="https://..."
          />
          <Input
            label="Thumbnail padrão das aulas (opcional)"
            value={defaultLessonThumbnail}
            onChange={(e) => { setDefaultLessonThumbnail(e.target.value); markDirty(); }}
            placeholder="https://... (usada em aulas sem thumbnail própria)"
          />

          {/* Free/Paid toggle */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-charcoal">Tipo:</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIsFree(true); markDirty(); }}
                className={`px-4 py-2 rounded-button text-sm font-medium transition-all ${
                  isFree
                    ? "bg-teal text-white"
                    : "bg-cream-alt text-muted"
                }`}
              >
                Gratuito
              </button>
              <button
                type="button"
                onClick={() => { setIsFree(false); markDirty(); }}
                className={`px-4 py-2 rounded-button text-sm font-medium transition-all ${
                  !isFree
                    ? "bg-accent text-white"
                    : "bg-cream-alt text-muted"
                }`}
              >
                Pago
              </button>
            </div>
          </div>

          {!isFree && (
            <Input
              label="Preço (R$)"
              type="number"
              value={(priceCents / 100).toFixed(2)}
              onChange={(e) => {
                setPriceCents(Math.round(parseFloat(e.target.value || "0") * 100));
                markDirty();
              }}
              step="0.01"
              min="0"
              placeholder="99.00"
            />
          )}

          {isAdmin && instructors.length > 0 && (
            <Select
              label="Professor responsável"
              value={instructorId}
              onChange={(e) => { setInstructorId(e.target.value); markDirty(); }}
              options={instructors}
              placeholder="Selecione um professor"
            />
          )}

          <Select
            label="Status"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            options={[
              { value: "draft", label: "Rascunho" },
              { value: "published", label: "Publicado" },
              { value: "archived", label: "Arquivado" },
            ]}
          />

          <Select
            label="Tipo do curso"
            value={courseType}
            onChange={(e) => {
              const val = e.target.value as "async" | "sync";
              setCourseType(val);
              markDirty();
              if (val === "sync" && ["exam", "certificate"].includes(step)) {
                setStep("content");
              }
            }}
            options={[
              { value: "async", label: "Gravado (assíncrono)" },
              { value: "sync", label: "Ao vivo + Gravação (síncrono)" },
            ]}
          />

          <Input
            label="WhatsApp de contato"
            value={whatsappNumber}
            onChange={(e) => { setWhatsappNumber(e.target.value); markDirty(); }}
            placeholder="5531999999999"
          />

          {/* Learning points */}
          <div>
            <label className="text-sm font-medium text-charcoal block mb-2">
              O que você vai aprender
            </label>
            <div className="space-y-2">
              {learningPoints.map((point, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={point}
                    onChange={(e) => {
                      const next = [...learningPoints];
                      next[i] = e.target.value;
                      setLearningPoints(next);
                      markDirty();
                    }}
                    placeholder="Ex: Entender os fundamentos da psicoterapia"
                    className="flex-1 px-4 py-2 rounded-[10px] text-sm text-cream placeholder:text-cream/25 focus:outline-none transition-all duration-250"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1.5px solid rgba(255,255,255,0.08)",
                      color: "rgba(253,251,247,0.9)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLearningPoints((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      );
                      markDirty();
                    }}
                    className="p-2 text-muted hover:text-accent"
                    aria-label="Remover"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => { setLearningPoints((prev) => [...prev, ""]); markDirty(); }}
                className="text-sm text-teal hover:text-teal-dark flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Adicionar ponto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content step */}
      {step === "content" && (
        <div className="space-y-6">
          {/* Default duration toolbar */}
          <div
            className="flex flex-wrap items-center gap-3 p-4 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Clock className="h-4 w-4 text-cream/30" />
            <span className="text-xs text-cream/50 font-medium">Duração padrão:</span>
            <input
              type="number"
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(parseInt(e.target.value) || 0)}
              className="w-20 px-2.5 py-1.5 text-xs rounded-lg text-cream placeholder:text-cream/25 focus:outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(253,251,247,0.9)" }}
              min="1"
            />
            <span className="text-xs text-cream/30">min</span>
            <button
              type="button"
              onClick={() => setDefaultDurationForAll(defaultDuration)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: "rgba(200,75,49,0.12)", border: "1px solid rgba(200,75,49,0.2)", color: "#C84B31" }}
            >
              Aplicar a todas as aulas
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section, si) => (
                <SortableItem key={section.id} id={section.id}>
                  {({ dragHandleProps }) => (
                  <div
                    className="rounded-card p-6"
                    style={{
                      background: section.is_extra ? "rgba(139,92,246,0.04)" : "rgba(255,255,255,0.04)",
                      border: section.is_extra ? "1px solid rgba(139,92,246,0.15)" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className="cursor-grab active:cursor-grabbing touch-none" {...dragHandleProps}>
                        <GripVertical className="h-5 w-5 text-cream/20 hover:text-cream/50 transition-colors" />
                      </span>
                      {/* Move section buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveSection(si, si - 1)}
                          disabled={si === 0}
                          className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Mover para cima"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(si, si + 1)}
                          disabled={si === sections.length - 1}
                          className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      {section.is_extra && (
                        <span
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                          style={{ background: "rgba(139,92,246,0.15)", color: "rgb(167,139,250)", border: "1px solid rgba(139,92,246,0.25)" }}
                        >
                          <Sparkles className="h-3 w-3" />
                          Extra
                        </span>
                      )}
                      <input
                        value={section.title}
                        onChange={(e) => updateSection(si, e.target.value)}
                        className="flex-1 font-semibold text-cream bg-transparent border-b border-transparent hover:border-white/10 focus:border-teal focus:outline-none py-1"
                        placeholder="Nome da seção"
                      />
                      {/* Toggle extra */}
                      <button
                        type="button"
                        onClick={() => {
                          markDirty();
                          setSections((prev) => {
                            const next = [...prev];
                            next[si] = { ...next[si], is_extra: !next[si].is_extra };
                            return next;
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex-shrink-0"
                        style={{
                          background: section.is_extra ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
                          border: section.is_extra ? "1px solid rgba(139,92,246,0.2)" : "1px solid rgba(255,255,255,0.06)",
                          color: section.is_extra ? "rgb(167,139,250)" : "rgba(253,251,247,0.3)",
                        }}
                        title={section.is_extra ? "Módulo extra: não obrigatório para certificado" : "Tornar módulo extra (opcional)"}
                      >
                        {section.is_extra ? "Extra ✓" : "Marcar extra"}
                      </button>
                      {/* Default duration for section */}
                      <button
                        type="button"
                        onClick={() => setDefaultDurationForSection(si, defaultDuration)}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex-shrink-0"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(253,251,247,0.3)" }}
                        title={`Aplicar ${defaultDuration}min a todas as aulas deste módulo`}
                      >
                        <Clock className="h-3 w-3 inline mr-1" />
                        {defaultDuration}min
                      </button>
                      {/* Delete section with confirmation */}
                      {deleteConfirmId === `section-${section.id}` ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-cream/40">Excluir seção?</span>
                          <button
                            onClick={() => removeSection(si)}
                            className="px-2 py-0.5 bg-accent text-white rounded font-medium hover:bg-accent/90"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-0.5 bg-white/10 text-cream/50 rounded font-medium hover:bg-white/15"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(`section-${section.id}`)}
                          className="p-1 text-cream/30 hover:text-accent"
                          aria-label="Remover seção"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Lessons */}
                    <div className="space-y-3 ml-8">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd(si)}>
                        <SortableContext items={section.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                          {section.lessons.map((lesson, li) => (
                            <SortableItem key={lesson.id} id={lesson.id}>
                              {({ dragHandleProps: lessonDragProps }) => (
                              <div
                                className="rounded-button p-4 space-y-3"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="cursor-grab active:cursor-grabbing touch-none" {...lessonDragProps}>
                                    <GripVertical className="h-4 w-4 text-cream/20 hover:text-cream/50 transition-colors" />
                                  </span>
                                  {/* Move lesson buttons */}
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => moveLesson(si, li, li - 1)}
                                      disabled={li === 0}
                                      className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                      title="Mover para cima"
                                    >
                                      <ArrowUp className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveLesson(si, li, li + 1)}
                                      disabled={li === section.lessons.length - 1}
                                      className="p-0.5 text-cream/20 hover:text-cream/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                      title="Mover para baixo"
                                    >
                                      <ArrowDown className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                  <input
                                    value={lesson.title}
                                    onChange={(e) =>
                                      updateLesson(si, li, "title", e.target.value)
                                    }
                                    placeholder="Título da aula"
                                    className="flex-1 text-sm text-cream bg-transparent border-b border-transparent hover:border-white/10 focus:border-teal focus:outline-none py-1 placeholder:text-cream/25"
                                  />
                                  {/* Delete lesson with confirmation */}
                                  {deleteConfirmId === `lesson-${lesson.id}` ? (
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <span className="text-cream/40">Excluir?</span>
                                      <button
                                        onClick={() => removeLesson(si, li)}
                                        className="px-2 py-0.5 bg-accent text-white rounded font-medium hover:bg-accent/90"
                                      >
                                        Sim
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="px-2 py-0.5 bg-white/10 text-cream/50 rounded font-medium hover:bg-white/15"
                                      >
                                        Não
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmId(`lesson-${lesson.id}`)}
                                      className="p-1 text-cream/30 hover:text-accent"
                                      aria-label="Remover aula"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <input
                                      value={lesson.video_url || ""}
                                      onChange={(e) =>
                                        updateLesson(si, li, "video_url", e.target.value)
                                      }
                                      placeholder="URL do vídeo (YouTube / Drive)"
                                      className="w-full px-3 py-2 text-xs rounded-button focus:outline-none focus:border-teal text-cream placeholder:text-cream/25"
                                      style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                                    />
                                    {/* Video URL preview */}
                                    <VideoUrlPreview url={lesson.video_url} />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-cream/30 uppercase tracking-wider mb-1 block">Duração (min)</label>
                                    <input
                                      type="number"
                                      value={lesson.duration_minutes || ""}
                                      onChange={(e) =>
                                        updateLesson(
                                          si,
                                          li,
                                          "duration_minutes",
                                          parseInt(e.target.value) || null
                                        )
                                      }
                                      placeholder="Ex: 45"
                                      className="w-full px-3 py-2 text-xs rounded-button focus:outline-none focus:border-teal text-cream placeholder:text-cream/25"
                                      style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                                    />
                                  </div>
                                </div>

                                <input
                                  value={lesson.thumbnail_url || ""}
                                  onChange={(e) =>
                                    updateLesson(si, li, "thumbnail_url", e.target.value)
                                  }
                                  placeholder="Thumbnail da aula (opcional — sobrescreve o padrão do curso)"
                                  className="w-full px-3 py-2 text-xs rounded-button focus:outline-none focus:border-teal text-cream placeholder:text-cream/25"
                                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                                />

                                <textarea
                                  value={lesson.description || ""}
                                  onChange={(e) =>
                                    updateLesson(si, li, "description", e.target.value)
                                  }
                                  placeholder="Descrição da aula (Markdown)"
                                  rows={2}
                                  className="w-full px-3 py-2 text-xs rounded-button resize-y focus:outline-none focus:border-teal text-cream placeholder:text-cream/25"
                                  style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                                />

                                <label className="flex items-center gap-2 text-xs text-cream/50">
                                  <input
                                    type="checkbox"
                                    checked={lesson.is_preview}
                                    onChange={(e) =>
                                      updateLesson(si, li, "is_preview", e.target.checked)
                                    }
                                    className="accent-teal"
                                  />
                                  Preview gratuito
                                </label>
                              </div>
                              )}
                            </SortableItem>
                          ))}
                        </SortableContext>
                      </DndContext>

                      <button
                        onClick={() => addLesson(si)}
                        className="flex items-center gap-1 text-sm text-teal hover:text-teal-dark py-2"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Nova aula
                      </button>
                    </div>
                  </div>
                  )}
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>

          <div className="flex gap-3 flex-wrap">
            <Button variant="secondary" onClick={() => addSection(false)}>
              <Plus className="h-4 w-4" />
              Nova seção
            </Button>
            <button
              type="button"
              onClick={() => addSection(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all hover:opacity-80"
              style={{
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.2)",
                color: "rgb(167,139,250)",
              }}
            >
              <Sparkles className="h-4 w-4" />
              Nova seção extra
            </button>
          </div>

          {sections.some(s => s.is_extra) && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl text-sm"
              style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}
            >
              <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "rgb(167,139,250)" }} />
              <div className="text-cream/50">
                <span className="font-semibold" style={{ color: "rgb(167,139,250)" }}>Seções extras</span> não são obrigatórias para conclusão do curso nem para a prova. Se o aluno completá-las, as horas dessas aulas são somadas ao certificado.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exam step */}
      {step === "exam" && (
        <div className="space-y-6 max-w-2xl">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={examEnabled}
              onChange={(e) => { setExamEnabled(e.target.checked); markDirty(); }}
              className="w-5 h-5 accent-teal"
            />
            <span className="font-medium text-cream">
              Este curso tem prova final
            </span>
          </label>

          {examEnabled && (
            <>
              <div>
                <label className="text-sm font-medium text-cream/70 block mb-2">
                  Nota mínima para aprovação: {examPassingScore}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={examPassingScore}
                  onChange={(e) => {
                    setExamPassingScore(parseInt(e.target.value));
                    markDirty();
                  }}
                  className="w-full accent-teal"
                />
              </div>

              {/* Questions */}
              <div className="space-y-4">
                {questions.map((q, qi) => (
                  <div
                    key={q.id}
                    className="rounded-card p-6"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <span className="text-sm font-bold text-teal">
                        {qi + 1}.
                      </span>
                      <div className="flex-1">
                        <textarea
                          value={q.question_text}
                          onChange={(e) => updateQuestion(qi, e.target.value)}
                          placeholder="Texto da pergunta"
                          rows={2}
                          className="w-full px-3 py-2 text-sm rounded-button resize-y focus:outline-none focus:border-teal text-cream placeholder:text-cream/25"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                        />
                      </div>
                      <button
                        onClick={() => removeQuestion(qi)}
                        className="p-1 text-cream/30 hover:text-accent"
                        aria-label="Remover pergunta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2 ml-6">
                      {q.options.map((opt: ExamOption, oi: number) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={opt.is_correct}
                            onChange={() => setCorrectOption(qi, oi)}
                            className="accent-teal"
                            aria-label={`Marcar opção ${oi + 1} como correta`}
                          />
                          <input
                            value={opt.text}
                            onChange={(e) =>
                              updateOption(qi, oi, e.target.value)
                            }
                            placeholder={`Opção ${oi + 1}`}
                            className="flex-1 px-3 py-1.5 text-sm rounded-button focus:outline-none focus:border-teal text-cream placeholder:text-cream/25"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)", color: "rgba(253,251,247,0.9)" }}
                          />
                          {q.options.length > 2 && (
                            <button
                              onClick={() => removeOption(qi, oi)}
                              className="p-1 text-cream/30 hover:text-accent"
                              aria-label="Remover opção"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {q.options.length < 6 && (
                        <button
                          onClick={() => addOption(qi)}
                          className="text-xs text-teal hover:text-teal-dark flex items-center gap-1 mt-1"
                        >
                          <Plus className="h-3 w-3" />
                          Opção
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <Button variant="secondary" onClick={addQuestion}>
                  <Plus className="h-4 w-4" />
                  Nova pergunta
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Certificate step */}
      {step === "certificate" && (
        <div className="max-w-2xl space-y-6">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={certificateEnabled}
              onChange={(e) => { setCertificateEnabled(e.target.checked); markDirty(); }}
              className="w-5 h-5 accent-teal"
            />
            <span className="font-medium text-cream">
              Emitir certificado ao concluir o curso
            </span>
          </label>

          {certificateEnabled && (
            <div className="space-y-6">
              {/* Certificate hours */}
              <div>
                <label className="text-sm font-medium text-cream/70 block mb-2">
                  Carga horária do certificado (horas)
                </label>
                <p className="text-xs text-cream/35 mb-2">
                  Se vazio, será calculado automaticamente a partir da duração total das aulas.
                </p>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={certificateHours ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseInt(e.target.value) : null;
                    setCertificateHours(v);
                    markDirty();
                  }}
                  placeholder="Ex: 45"
                  className="w-full max-w-[200px] px-4 py-2.5 rounded-[10px] text-sm text-cream placeholder:text-cream/25 focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1.5px solid rgba(255,255,255,0.08)",
                    color: "rgba(253,251,247,0.9)",
                  }}
                />
              </div>

              {/* Certificate body text */}
              <div>
                <label className="text-sm font-medium text-cream/70 block mb-2">
                  Texto do certificado
                </label>
                <p className="text-xs text-cream/35 mb-2">
                  Texto principal do certificado. Use <code className="text-teal/70">{"{nome}"}</code> para o nome do aluno, <code className="text-teal/70">{"{curso}"}</code> para o título do curso, <code className="text-teal/70">{"{horas}"}</code> para a carga horária e <code className="text-teal/70">{"{data}"}</code> para a data de emissão. Se vazio, usa o texto padrão.
                </p>
                <textarea
                  value={certificateBodyText}
                  onChange={(e) => { setCertificateBodyText(e.target.value); markDirty(); }}
                  placeholder={'Certificamos que {nome} concluiu com aproveitamento o curso "{curso}", promovido pela Associação Allos, com carga horária total de {horas} horas, em {data}.'}
                  rows={4}
                  className="w-full px-4 py-3 rounded-[10px] text-sm text-cream placeholder:text-cream/25 resize-y focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1.5px solid rgba(255,255,255,0.08)",
                    color: "rgba(253,251,247,0.9)",
                  }}
                />
              </div>

              {/* Certificate preview */}
              <div>
                <p className="text-xs text-cream/30 uppercase tracking-wider font-semibold mb-3">
                  Preview
                </p>
                <div
                  className="rounded-card p-8 text-center"
                  style={{
                    background: "rgba(255,255,255,0.97)",
                    border: "2px solid rgba(200,75,49,0.15)",
                  }}
                >
                  <p className="text-xs text-[#888] tracking-wider uppercase mb-4">
                    ASSOCIAÇÃO ALLOS · CERTIFICADO
                  </p>
                  <p className="text-sm text-[#444] mb-1">Certificamos que</p>
                  <p className="font-fraunces font-bold text-xl text-[#c0392b] italic mb-4">
                    Nome do Aluno
                  </p>
                  <p className="text-sm text-[#444] mb-1 max-w-md mx-auto leading-relaxed">
                    {certificateBodyText
                      ? certificateBodyText
                          .replace("{nome}", "Nome do Aluno")
                          .replace("{curso}", title || "Nome do Curso")
                          .replace("{horas}", String(certificateHours || "XX"))
                          .replace("{data}", "20 de março de 2026")
                      : `concluiu com aproveitamento o curso "${title || "Nome do Curso"}", promovido pela Associação Allos, com carga horária total de ${certificateHours || "XX"} horas.`}
                  </p>
                  <div className="mt-6 pt-4" style={{ borderTop: "1px solid #eee" }}>
                    <p className="text-xs text-[#888] italic">
                      Coordenação Allos
                    </p>
                  </div>
                  <p className="text-[10px] text-[#bbb] mt-4">
                    ALLOS-2026-XXXXXX
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push("/formacao/admin/cursos")}
          >
            Cancelar
          </Button>
          {/* Unsaved changes indicator */}
          {isDirty && (
            <span className="text-xs text-accent font-medium animate-pulse">
              Alterações não salvas
            </span>
          )}
          {/* Autosave indicator */}
          {isAutoSaving && (
            <span className="text-xs text-cream/30 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-cream/30 animate-pulse" />
              Salvando...
            </span>
          )}
          {!isAutoSaving && lastAutoSaved && !isDirty && (
            <span className="text-xs text-cream/30">
              Salvo automaticamente às{" "}
              {lastAutoSaved.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {step !== "info" && (
            <Button
              variant="ghost"
              onClick={() => {
                const idx = STEPS.findIndex((s) => s.id === step);
                if (idx > 0) setStep(STEPS[idx - 1].id);
              }}
            >
              Anterior
            </Button>
          )}
          {step !== STEPS[STEPS.length - 1].id ? (
            <Button
              onClick={() => {
                const idx = STEPS.findIndex((s) => s.id === step);
                if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].id);
              }}
            >
              Próximo
            </Button>
          ) : (
            <Button loading={saving} onClick={() => saveCourse()}>
              {isEdit ? "Salvar alterações" : "Criar curso"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
