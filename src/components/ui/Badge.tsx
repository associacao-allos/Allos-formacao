interface BadgeProps {
  variant: "free" | "paid" | "draft" | "published" | "archived" | "student" | "instructor" | "admin" | "associado" | "sync";
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeProps["variant"], string> = {
  free: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  paid: "bg-accent/15 text-accent border border-accent/20",
  draft: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  published: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  archived: "bg-white/8 text-cream/50 border border-white/10",
  student: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  instructor: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  admin: "bg-accent/15 text-accent border border-accent/20",
  associado: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  sync: "bg-teal-500/15 text-teal-400 border border-teal-500/20",
};

export default function Badge({ variant, children, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        text-[11px] font-semibold tracking-wide
        rounded-pill
        backdrop-blur-sm
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
