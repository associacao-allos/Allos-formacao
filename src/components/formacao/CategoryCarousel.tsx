"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import CourseCard from "@/components/course/CourseCard";
import type { Course } from "@/types";

interface CategoryCarouselProps {
  title: string;
  courses: Course[];
  index: number;
}

export default function CategoryCarousel({ title, courses, index }: CategoryCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, courses]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }

  if (courses.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5 px-5 sm:px-6 md:px-8">
        <div className="flex items-center gap-3">
          <h2 className="font-fraunces font-bold text-[#FDFBF7] text-lg sm:text-xl">
            {title}
          </h2>
          <Link
            href={`/formacao?categoria=${encodeURIComponent(title)}`}
            className="font-dm text-sm font-medium text-[#C84B31] hover:text-[#e0613f] transition-colors flex items-center gap-1"
          >
            Ver tudo <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Navigation arrows */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            aria-label="Rolar para a esquerda"
          >
            <ChevronLeft className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            aria-label="Rolar para a direita"
          >
            <ChevronRight className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-5 sm:px-6 md:px-8 pb-2"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {courses.map((course) => (
          <div
            key={course.id}
            className="flex-shrink-0 w-[200px] sm:w-[220px] md:w-[240px] lg:w-[260px]"
            style={{ scrollSnapAlign: "start" }}
          >
            <CourseCard course={course} />
          </div>
        ))}
      </div>
    </motion.section>
  );
}
