"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? "text-zinc-950" : "text-zinc-500"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function ProjectsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? "text-zinc-950" : "text-zinc-500"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M7 7h4" />
      <path d="M7 17h7" />
    </svg>
  );
}

function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? "text-zinc-950" : "text-zinc-500"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  if (!pathname || pathname === "/login") {
    return null;
  }

  const items = [
    {
      href: "/",
      label: "Home",
      active: pathname === "/",
      icon: HomeIcon,
    },
    {
      href: "/projects",
      label: "Projects",
      active: pathname.startsWith("/projects") || pathname.startsWith("/project"),
      icon: ProjectsIcon,
    },
    {
      href: "/profile",
      label: "Account",
      active: pathname.startsWith("/profile") || pathname.startsWith("/user"),
      icon: AccountIcon,
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[padding:max(0px)]:pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 px-3 py-2">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition ${
                item.active ? "bg-zinc-100 text-zinc-950" : "text-zinc-500"
              }`}
              aria-current={item.active ? "page" : undefined}
            >
              <Icon active={item.active} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}