interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-[10px] ${className}`}
      style={{ background: "rgba(255,255,255,0.05)" }}
      aria-hidden="true"
    />
  );
}

export function CourseCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden aspect-[3/4]"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <Skeleton className="w-full h-full rounded-none" />
    </div>
  );
}
