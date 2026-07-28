"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryDestinations = [
  ["Today", "/"],
  ["Library", "/saved"],
  ["Interests", "/interests"],
  ["Calendar", "/calendar"],
] as const;

const libraryDestinations = [
  ["Saved", "/saved"],
  ["Later", "/later"],
  ["History", "/history"],
] as const;

const isLibraryPath = (pathname: string): boolean =>
  pathname === "/saved" || pathname === "/later" || pathname === "/history";

export function AppNavigation() {
  const pathname = usePathname();

  const isPrimaryActive = (
    href: (typeof primaryDestinations)[number][1],
  ): boolean => {
    if (href === "/") {
      return pathname === "/" || pathname.startsWith("/briefings/");
    }
    if (href === "/saved") return isLibraryPath(pathname);
    return pathname === href;
  };

  return (
    <nav aria-label="Tempo sections" className="appNav">
      <div className="appNavPrimary">
        {primaryDestinations.map(([label, href]) => (
          <Link
            aria-current={isPrimaryActive(href) ? "page" : undefined}
            className={isPrimaryActive(href) ? "active" : undefined}
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
      </div>
      {isLibraryPath(pathname) ? (
        <div
          aria-label="Library views"
          className="appNavSecondary"
          role="group"
        >
          {libraryDestinations.map(([label, href]) => (
            <Link
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "active" : undefined}
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
