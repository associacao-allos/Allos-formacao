"use client";

import { useSidebarWidth } from "./Sidebar";

export default function SidebarOffset({ children }: { children: React.ReactNode }) {
  const sidebarWidth = useSidebarWidth();

  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{ marginLeft: sidebarWidth }}
    >
      {children}
    </div>
  );
}
