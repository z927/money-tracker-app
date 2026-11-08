"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./theme-toggle";

const nav = [
  { href: "/", label: "Home" },
  { href: "/connect", label: "Connetti banca" },
];

export default function Sidebar() {
  const [open, setOpen] = useState<boolean>(false);
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden fixed inset-y-0 left-0 z-20 w-64 border-r border-surface-border bg-surface overflow-y-auto flex flex-col">
        <div className="p-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center text-slate-950 font-bold">M</div>
          <span className="font-semibold text-foreground tracking-tight">Money Tracker</span>
        </div>
        <nav className="mt-4 px-3 space-y-1">
          {nav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm text-foreground/80 block transition ${isActive ? "bg-accent/10 text-accent font-medium" : "hover:bg-accent/5 hover:text-foreground"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 border-t border-surface-border">
          <ThemeToggle />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-surface-border transform transition-transform duration-300 md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="font-semibold text-foreground">Menu</div>
          <button onClick={() => setOpen(false)} className="text-foreground/60 hover:text-foreground">✕</button>
        </div>
        <nav className="mt-4 px-3 space-y-1">
          {nav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm text-foreground/80 ${isActive ? "bg-accent/10 text-accent font-medium" : "hover:bg-accent/5"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 border-t border-surface-border">
          <ThemeToggle />
        </div>
      </aside>

      <button
        className="md:hidden fixed left-4 top-4 z-50 rounded-xl border border-surface-border bg-surface px-3 py-2 text-foreground transition hover:bg-accent/5"
        onClick={() => setOpen(true)}
        aria-label="Apri menu"
      >
        ☰
      </button>
    </>
  );
}
