"use client";

const destinations = [
  ["Today", "/"],
  ["Interests", "/interests"],
  ["Saved", "/saved"],
  ["Later", "/later"],
  ["History", "/history"],
  ["Calendar", "/calendar"],
] as const;

export function AppNavigation() {
  return (
    <nav aria-label="Tempo" className="appNav">
      {destinations.map(([label, href]) => (
        <a href={href} key={href}>
          {label}
        </a>
      ))}
    </nav>
  );
}
