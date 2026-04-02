import { CourseCardSkeleton } from "@/components/ui/Skeleton";
import Skeleton from "@/components/ui/Skeleton";

export default function FormacaoLoading() {
  return (
    <div className="px-5 sm:px-6 md:px-8 py-8">
      {/* Hero skeleton */}
      <div className="mb-10 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-80" />
      </div>

      {/* Category skeleton */}
      {[0, 1].map((i) => (
        <div key={i} className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="flex-shrink-0 w-[200px] sm:w-[220px] md:w-[240px] lg:w-[260px]">
                <CourseCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
