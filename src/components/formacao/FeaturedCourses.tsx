"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Radio, ArrowRight } from "lucide-react";
import { createDataClient } from "@/lib/supabase/client";
import Link from "next/link";

interface FeaturedCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  featured_label: string | null;
  course_type: "async" | "sync";
  is_free: boolean;
  price: number | null;
}

export default function FeaturedCourses() {
  const [courses, setCourses] = useState<FeaturedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    async function fetch() {
      const { data } = await createDataClient()
        .from("courses")
        .select("*")
        .eq("status", "published")
        .eq("featured", true)
        .order("updated_at", { ascending: false })
        .limit(3);

      if (data) setCourses(data);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading || courses.length === 0) return null;

  return (
    <section ref={ref} className="relative py-12 px-5 sm:px-6 md:px-10">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-6 flex items-center gap-3"
        >
          <Radio size={16} className="text-[#C84B31] animate-pulse" />
          <h2 className="font-fraunces font-bold text-lg text-[#FDFBF7]">
            Em destaque
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href={`/formacao/curso/${course.slug}`}
                className="group block rounded-2xl overflow-hidden transition-all hover:-translate-y-1"
                style={{
                  background: "rgba(253,251,247,0.02)",
                  border: "1px solid rgba(200,75,49,0.12)",
                }}
              >
                {/* Thumbnail */}
                {course.thumbnail_url && (
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(to top, rgba(17,17,17,0.8) 0%, transparent 60%)" }}
                    />
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {course.featured_label && (
                        <span
                          className="font-dm text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: "rgba(200,75,49,0.9)",
                            color: "#fff",
                          }}
                        >
                          {course.featured_label}
                        </span>
                      )}
                      {course.course_type === "sync" && (
                        <span
                          className="font-dm text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1"
                          style={{
                            backgroundColor: "rgba(46,158,143,0.9)",
                            color: "#fff",
                          }}
                        >
                          <Radio size={10} className="animate-pulse" />
                          Ao vivo
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-5">
                  <h3 className="font-fraunces font-bold text-[#FDFBF7] text-sm mb-1.5 group-hover:text-[#C84B31] transition-colors">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p
                      className="font-dm text-xs leading-relaxed line-clamp-2 mb-3"
                      style={{ color: "rgba(253,251,247,0.4)" }}
                    >
                      {course.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span
                      className="font-dm text-xs font-medium"
                      style={{ color: course.is_free ? "#2E9E8F" : "#C84B31" }}
                    >
                      {course.is_free ? "Gratuito" : `R$ ${course.price?.toFixed(2)}`}
                    </span>
                    <span className="font-dm text-[11px] flex items-center gap-1 text-[#C84B31] opacity-0 group-hover:opacity-100 transition-opacity">
                      Acessar <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
