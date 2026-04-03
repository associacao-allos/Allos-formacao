"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Clock, Users, BookOpen, Lock, Radio } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatPrice, formatDuration } from "@/lib/utils/format";
import type { Course } from "@/types";

interface CourseCardProps {
  course: Course;
  isInstructor?: boolean;
}

export default function CourseCard({ course, isInstructor }: CourseCardProps) {
  const displayPrice = course.is_free
    ? null
    : course.price_cents
      ? formatPrice(course.price_cents)
      : null;

  return (
    <Link
      href={`/formacao/curso/${course.slug}`}
      className="group block"
    >
      <article className="relative aspect-[9/13] rounded-2xl overflow-hidden cursor-pointer">
        {/* Background image */}
        {course.thumbnail_url ? (
          <Image
            src={course.thumbnail_url}
            alt={course.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #1C1414 0%, #2a1a1a 50%, #0F0F0F 100%)",
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(200,75,49,0.08)",
                border: "1px solid rgba(200,75,49,0.15)",
              }}
            >
              <BookOpen className="h-6 w-6" style={{ color: "rgba(200,75,49,0.4)" }} />
            </div>
          </div>
        )}

        {/* Default gradient overlay - subtle at bottom for title */}
        <div
          className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.7) 100%)",
          }}
        />

        {/* Hover overlay - dark with details */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-5"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.88) 100%)",
          }}
        >
          {/* Title */}
          <h3 className="font-fraunces font-bold text-white text-base leading-tight line-clamp-2 mb-1.5">
            {course.title}
          </h3>

          {course.instructor && (
            <p className="font-dm text-xs text-white/60 mb-3">
              {course.instructor.full_name}
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50 mb-4">
            {course.average_rating !== undefined && course.average_rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-white/70 font-medium">
                  {course.average_rating.toFixed(1)}
                </span>
                {course.reviews_count !== undefined && (
                  <span>({course.reviews_count})</span>
                )}
              </span>
            )}
            {course.enrollments_count !== undefined && course.enrollments_count > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {course.enrollments_count}
              </span>
            )}
            {course.total_duration_minutes && course.total_duration_minutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(course.total_duration_minutes)}
              </span>
            )}
          </div>

          {/* CTA */}
          <span
            className="inline-flex items-center justify-center w-full py-2 rounded-xl text-xs font-dm font-semibold text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #C84B31, #A33D27)",
              boxShadow: "0 4px 16px rgba(200,75,49,0.3)",
            }}
          >
            {course.course_type === "sync"
              ? "Acessar gravações →"
              : course.is_free
                ? "Começar grátis →"
                : "Ver curso →"}
          </span>
        </div>

        {/* Top-right badges (always visible) */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 items-end">
          {!course.is_free && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            >
              <Lock className="w-3.5 h-3.5 text-white/80" />
            </div>
          )}
          {course.course_type === "sync" && (
            <Badge variant="sync">
              <Radio className="h-2.5 w-2.5 mr-1" />
              Ao vivo
            </Badge>
          )}
          {isInstructor && (
            <Badge variant="instructor">Meu curso</Badge>
          )}
        </div>

        {/* Top-left price badge */}
        <div className="absolute top-3 left-3 z-10">
          {course.is_free ? (
            <Badge variant="free">Gratuito</Badge>
          ) : (
            displayPrice && <Badge variant="paid">{displayPrice}</Badge>
          )}
        </div>

        {/* Default state: title at bottom (hidden on hover) */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10 group-hover:opacity-0 transition-opacity duration-300">
          <h3 className="font-fraunces font-bold text-white text-base leading-tight line-clamp-2 drop-shadow-lg">
            {course.title}
          </h3>
          {course.instructor && (
            <p className="font-dm text-xs text-white/60 mt-1.5">
              {course.instructor.full_name}
            </p>
          )}
        </div>

        {/* Hover border */}
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-[#C84B31]/50 transition-colors duration-300 pointer-events-none" />
      </article>
    </Link>
  );
}
