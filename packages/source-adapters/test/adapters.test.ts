import { readFile } from "node:fs/promises";

import { NormalizedSourceItemSchema } from "@tempo/contracts";
import { describe, expect, it } from "vitest";

import {
  FederalReservePressReleaseAdapter,
  isRetryableSourceError,
  LibraryOfCongressNewsAdapter,
  NasaNewsAdapter,
  SourceHttpError,
  type HttpFetcher,
} from "../src/index.js";

const discoveredAt = "2026-07-17T20:00:00.000Z";

const fixture = async (fileName: string): Promise<string> =>
  readFile(new URL(`./fixtures/${fileName}`, import.meta.url), "utf8");

describe("foundation source adapters", () => {
  it("normalizes NASA news and removes tracking parameters", async () => {
    const adapter = new NasaNewsAdapter();
    const xml = await fixture("nasa-news.xml");
    const first = adapter.parse(xml, discoveredAt);
    const second = adapter.parse(xml, discoveredAt);

    expect(first.rejected).toEqual([]);
    expect(first.items).toHaveLength(1);
    const item = NormalizedSourceItemSchema.parse(first.items[0]);
    expect(item).toMatchObject({
      sourceKey: "nasa-news",
      externalId: "nasa-release-2026-042",
      author: "NASA Headquarters",
      publishedAt: "2026-07-17T14:30:00.000Z",
      excerpt: "The mission will study changes in Earth's atmosphere.",
    });
    expect(item.canonicalUrl).toBe(
      "https://www.nasa.gov/news-release/earth-mission/?mission=tempo",
    );
    expect(item.metadata).toEqual({
      categories: ["Earth", "Science"],
      feedKind: "rss",
    });
    expect(second.items[0]?.contentHash).toBe(item.contentHash);
  });

  it("normalizes the Federal Reserve RDF feed shape", async () => {
    const adapter = new FederalReservePressReleaseAdapter();
    const result = adapter.parse(
      await fixture("federal-reserve.xml"),
      discoveredAt,
    );

    expect(result.rejected).toEqual([]);
    expect(result.items[0]).toMatchObject({
      sourceKey: "federal-reserve-press",
      title: "Federal Reserve issues policy statement",
      publishedAt: "2026-07-17T18:00:00.000Z",
      metadata: {
        categories: ["Monetary Policy"],
        feedKind: "rdf",
      },
    });
  });

  it("retains valid Library of Congress items and reports malformed ones", async () => {
    const adapter = new LibraryOfCongressNewsAdapter();
    const result = adapter.parse(
      await fixture("library-of-congress.xml"),
      discoveredAt,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      sourceKey: "library-of-congress-news",
      excerpt: "The collection includes newly digitized recordings.",
    });
    expect(result.rejected).toEqual([
      {
        index: 1,
        reason: "Feed entry requires a title and link.",
      },
    ]);
  });

  it("uses conditional request metadata and handles not-modified feeds", async () => {
    const requests: unknown[] = [];
    const fetcher: HttpFetcher = {
      get: (request) => {
        requests.push(request);
        return Promise.resolve({
          status: 304,
          body: null,
          etag: '"next-etag"',
          lastModified: "Fri, 17 Jul 2026 20:00:00 GMT",
        });
      },
    };
    const adapter = new NasaNewsAdapter();

    const result = await adapter.fetch(fetcher, {
      discoveredAt,
      etag: '"current-etag"',
    });

    expect(requests).toEqual([
      {
        url: adapter.source.feedUrl,
        etag: '"current-etag"',
      },
    ]);
    expect(result).toEqual({
      items: [],
      rejected: [],
      notModified: true,
      etag: '"next-etag"',
      lastModified: "Fri, 17 Jul 2026 20:00:00 GMT",
    });
  });

  it("classifies only transient transport failures as immediately retryable", () => {
    expect(
      isRetryableSourceError(
        new SourceHttpError(503, "https://example.com/feed.xml"),
      ),
    ).toBe(true);
    expect(
      isRetryableSourceError(
        new SourceHttpError(429, "https://example.com/feed.xml"),
      ),
    ).toBe(true);
    expect(
      isRetryableSourceError(
        new SourceHttpError(404, "https://example.com/feed.xml"),
      ),
    ).toBe(false);
    expect(isRetryableSourceError(new TypeError("Network unavailable."))).toBe(
      true,
    );
    expect(isRetryableSourceError(new Error("Invalid XML."))).toBe(false);
  });
});
