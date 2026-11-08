"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/connect", label: "Connetti" },
];

export default function BottomBar() {
  const pathname = usePathname();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-surface-border bg-surface/95 backdrop-blur-md px-4 py-3 md:hidden">
      <div className="flex justify-around gap-2">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 text-xs rounded-lg transition ${isActive ? "text-accent bg-accent/10" : "text-muted/70 hover:text-foreground hover:bg-accent/5"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
