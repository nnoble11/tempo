import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const metadataBase = new URL(
    host === null ? "http://localhost:3000" : `${protocol}://${host}`,
  );
  const title = "Tempo — Your daily briefing";
  const description =
    "A finite, citation-grounded daily briefing shaped around your interests and time.";
  return {
    metadataBase,
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: "/og.png", width: 1792, height: 896 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skipLink" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
