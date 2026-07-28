"use client";

import { usePathname } from "next/navigation";

const destinations = [
  ["Today", "/"],
  ["Interests", "/interests"],
  ["Saved", "/saved"],
  ["Later", "/later"],
  ["History", "/history"],
  ["Calendar", "/calendar"],
] as const;

export function AppNavigation() {
  const pathname = usePathname();

  const isActive = (href: (typeof destinations)[number][1]): boolean =>
    href === "/"
      ? pathname === "/" || pathname.startsWith("/briefings/")
      : pathname === href;

  return (
    <nav aria-label="Tempo" className="appNav">
      {destinations.map(([label, href]) => (
        <a
          aria-current={isActive(href) ? "page" : undefined}
          className={isActive(href) ? "active" : undefined}
          href={href}
          key={href}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
